import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "./auth";
import { canManageCourse, canManageOrg } from "./permissions";
import { enrollmentTrace } from "./reports";
import { audit } from "./audit";
import { db } from "./db";

/**
 * Contact d'une entreprise cliente : accès aux documents de ses salariés si l'OF a activé ce partage.
 * Les documents de fin de formation ne sont visibles qu'une fois la formation terminée ou interrompue.
 */
export async function companyCanSeeEnrollment(user: { role: string; companyId: string | null }, enrollmentId: string, requireFinished = false) {
  if (user.role !== "COMPANY" || !user.companyId) return false;
  const e = await db.enrollment.findUnique({ where: { id: enrollmentId }, select: { companyId: true, status: true, exitDate: true, company: { select: { shareDocuments: true, active: true } } } });
  if (!e || e.companyId !== user.companyId || !e.company?.shareDocuments || !e.company.active) return false;
  return !requireFinished || e.status === "COMPLETED" || e.status === "ABANDONED" || !!e.exitDate;
}

/** Charge la traçabilité d'une inscription si l'utilisateur y a droit (apprenant concerné, équipe OF, entreprise autorisée). */
export async function loadTraceForViewer(enrollmentId: string, docType: string, opts: { learnerRequiresFinished?: boolean } = {}) {
  const user = await requireUser();
  const trace = await enrollmentTrace(enrollmentId);
  if (!trace) notFound();
  const e = trace.enrollment;
  const allowed =
    e.userId === user.id ||
    canManageOrg(user, e.course.organization.id) ||
    (await canManageCourse(user, e.course.id)) ||
    (await companyCanSeeEnrollment(user, e.id, !!opts.learnerRequiresFinished));
  if (!allowed) notFound();
  // Un certificat de réalisation n'est délivré à l'apprenant qu'à la fin (ou à l'interruption) de sa formation
  if (opts.learnerRequiresFinished && e.userId === user.id && !(e.status === "COMPLETED" || e.status === "ABANDONED" || e.exitDate)) notFound();
  if (e.userId !== user.id) {
    await audit("export.report", {
      actorId: user.id,
      organizationId: e.course.organization.id,
      entityType: "Enrollment",
      entityId: e.id,
      details: { document: docType },
    });
  }
  return { user, trace };
}

/** Inscription complète (convention, convocation) si l'utilisateur y a droit. */
export async function loadEnrollmentForViewer(enrollmentId: string, docType: string) {
  const user = await requireUser();
  const e = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      user: { select: { id: true, name: true, email: true, profile: true } },
      course: {
        include: {
          organization: true,
          modules: { orderBy: { position: "asc" }, include: { lessons: { where: { published: true }, orderBy: { position: "asc" }, select: { title: true, durationMin: true } } } },
        },
      },
      session: true,
      application: { select: { number: true, fundingDetails: true } },
    },
  });
  if (!e) notFound();
  const allowed =
    e.userId === user.id || canManageOrg(user, e.course.organizationId) || (await canManageCourse(user, e.courseId)) || (await companyCanSeeEnrollment(user, e.id));
  if (!allowed) notFound();
  if (e.userId !== user.id) {
    await audit("export.report", { actorId: user.id, organizationId: e.course.organizationId, entityType: "Enrollment", entityId: e.id, details: { document: docType } });
  }
  return { user, enrollment: e, isLearner: e.userId === user.id };
}

/** Convention OF ↔ entreprise : responsable de l'organisme ou contact actif de l'entreprise concernée. */
export async function loadCompanyConvention(id: string) {
  const user = await requireUser();
  const conv = await db.companyConvention.findUnique({
    where: { id },
    include: { organization: true, company: true, session: { include: { course: true } } },
  });
  if (!conv) notFound();
  const allowed = canManageOrg(user, conv.organizationId) || (user.role === "COMPANY" && user.companyId === conv.companyId);
  if (!allowed || (user.role === "COMPANY" && conv.status === "CANCELLED")) notFound();
  const { companyConventionText } = await import("./company-convention");
  const text =
    conv.signedContent ??
    (conv.session ? companyConventionText(conv, conv.organization, conv.company, conv.session.course, conv.session).text : "Session supprimée : convention caduque.");
  return { user, conv, text };
}
