import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { canManageOrg, canViewLearner, manageableCoursesWhere } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { dateParam, learnersSummary } from "@/lib/reports";
import { ENROLLMENT_STATUS, EXIT_REASONS, FUNDING_TYPES } from "@/lib/labels";
import { formatDate, toCsv } from "@/lib/utils";

const EVT = { LOGIN: "Connexion", LOGOUT: "Déconnexion", FAILED: "Échec", LOCKED: "Verrouillé" } as const;
const iso = (d: Date | null | undefined) => (d ? d.toLocaleString("fr-FR") : "");
const hours = (s: number) => (Math.round((s / 3600) * 100) / 100).toString().replace(".", ",");

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return new NextResponse("Accès refusé", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const from = dateParam(sp.get("from"));
  const to = dateParam(sp.get("to"), true);
  const courseParam = sp.get("course");
  const userParam = sp.get("user");
  const enrollmentParam = sp.get("enrollment");

  const courses = await db.course.findMany({ where: manageableCoursesWhere(user), select: { id: true, title: true, organizationId: true } });
  let courseIds = courses.map((c) => c.id);
  if (courseParam) courseIds = courseIds.filter((id) => id === courseParam);
  const courseTitle = new Map(courses.map((c) => [c.id, c.title]));

  // Périmètre des apprenants visibles
  let userIds: string[] | null = null;
  if (userParam) {
    if (!(await canViewLearner(user, userParam))) return new NextResponse("Accès refusé", { status: 403 });
    userIds = [userParam];
  }
  let enrollmentFilter: { userId: string; courseId: string } | null = null;
  if (enrollmentParam) {
    const e = await db.enrollment.findUnique({ where: { id: enrollmentParam }, select: { userId: true, courseId: true } });
    if (!e || !courseIds.includes(e.courseId)) return new NextResponse("Accès refusé", { status: 403 });
    enrollmentFilter = e;
  }
  if (!userIds && !enrollmentFilter) {
    const enr = await db.enrollment.findMany({ where: { courseId: { in: courseIds } }, select: { userId: true } });
    userIds = [...new Set(enr.map((e) => e.userId))];
  }
  const dateWhere = (field: string) => (from || to ? { [field]: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {});

  let rows: unknown[][] = [];
  switch (kind) {
    case "summary": {
      const data = await learnersSummary(courseIds, from, to);
      rows = [
        ["Apprenant", "Email", "Formation", "Statut", "Date de sortie", "Motif de sortie", "Début", "Fin", "Heures prévues", "Heures réalisées", "Taux assiduité (%)", "Progression (%)", "Nb connexions", "Dernière activité", "Financement", "N° prise en charge"],
        ...data.map((r) => [
          r.enrollment.user.name, r.enrollment.user.email, r.enrollment.course.title,
                    ENROLLMENT_STATUS[r.enrollment.status].label,
          r.enrollment.exitDate ? formatDate(r.enrollment.exitDate) : "",
          r.enrollment.exitCategory ? EXIT_REASONS[r.enrollment.exitCategory] ?? r.enrollment.exitCategory : "",
          formatDate(r.enrollment.startDate), formatDate(r.enrollment.endDate), r.enrollment.plannedHours ?? "", hours(r.seconds),
          r.enrollment.plannedHours ? Math.round((r.seconds / 3600 / r.enrollment.plannedHours) * 100) : "",
          r.percent, r.logins, iso(r.lastActivity),
          r.enrollment.fundingType ? FUNDING_TYPES[r.enrollment.fundingType] : "", r.enrollment.fundingReference ?? "",
        ]),
      ];
      break;
    }
    case "logins": {
      const events = await db.loginEvent.findMany({
        where: { userId: enrollmentFilter ? enrollmentFilter.userId : { in: userIds ?? [] }, ...dateWhere("createdAt") },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true } } },
      });
      rows = [["Date", "Heure", "Apprenant", "Email", "Évènement", "Adresse IP", "Navigateur"], ...events.map((e) => [
        e.createdAt.toLocaleDateString("fr-FR"), e.createdAt.toLocaleTimeString("fr-FR"), e.user?.name ?? "", e.email, EVT[e.type], e.ip ?? "", e.userAgent ?? "",
      ])];
      break;
    }
    case "sessions": {
      const sessions = await db.activitySession.findMany({
        where: { userId: enrollmentFilter ? enrollmentFilter.userId : { in: userIds ?? [] }, ...dateWhere("startedAt") },
        orderBy: { startedAt: "asc" },
        include: { user: { select: { name: true, email: true } } },
      });
      rows = [["Apprenant", "Email", "Début", "Fin / dernier signal", "Temps actif (min)", "Temps actif (h)", "Adresse IP"], ...sessions.map((s) => [
        s.user.name, s.user.email, iso(s.startedAt), iso(s.endedAt ?? s.lastSeenAt), Math.round(s.activeSeconds / 60), hours(s.activeSeconds), s.ip ?? "",
      ])];
      break;
    }
    case "timelogs": {
      const where: Prisma.TimeLogWhereInput = enrollmentFilter
        ? { userId: enrollmentFilter.userId, courseId: enrollmentFilter.courseId }
        : { courseId: { in: courseIds }, ...(userIds ? { userId: { in: userIds } } : {}) };
      const logs = await db.timeLog.findMany({
        where: { ...where, ...dateWhere("startedAt") },
        orderBy: { startedAt: "asc" },
        include: { user: { select: { name: true, email: true } }, lesson: { select: { title: true, module: { select: { title: true, position: true } } } } },
      });
      rows = [["Apprenant", "Email", "Formation", "Module", "Leçon", "Début", "Fin", "Temps actif (s)", "Temps actif (min)"], ...logs.map((l) => [
        l.user.name, l.user.email, courseTitle.get(l.courseId) ?? "", `Module ${l.lesson.module.position + 1} · ${l.lesson.module.title}`, l.lesson.title,
        iso(l.startedAt), iso(l.endedAt), l.seconds, Math.round((l.seconds / 60) * 10) / 10,
      ])];
      break;
    }
    case "audit": {
      if (user.role === "TRAINER") return new NextResponse("Accès refusé", { status: 403 });
      const orgId = user.role === "ADMIN" ? sp.get("org") : user.organizationId;
      if (orgId && !canManageOrg(user, orgId)) return new NextResponse("Accès refusé", { status: 403 });
      const logs = await db.auditLog.findMany({
        where: { ...(orgId ? { organizationId: orgId } : {}), ...dateWhere("createdAt") },
        orderBy: { createdAt: "desc" },
        take: 20000,
        include: { actor: { select: { name: true, email: true } } },
      });
      rows = [["Date", "Utilisateur", "Email", "Action", "Objet", "Identifiant", "Détails", "IP"], ...logs.map((l) => [
        iso(l.createdAt), l.actor?.name ?? "", l.actor?.email ?? "", l.action, l.entityType ?? "", l.entityId ?? "", l.details ?? "", l.ip ?? "",
      ])];
      break;
    }
    default:
      return new NextResponse("Rapport inconnu", { status: 404 });
  }
  await audit(kind === "logins" || kind === "sessions" ? "export.connections" : "export.report", {
    actorId: user.id,
    organizationId: user.organizationId,
    details: { kind, course: courseParam, from: sp.get("from"), to: sp.get("to"), user: userParam, enrollment: enrollmentParam, rows: rows.length - 1 },
  });
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapport-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
