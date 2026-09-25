import Link from "next/link";
import { db } from "@/lib/db";
import { isOfManager, requireStaff } from "@/lib/auth";
import { manageableCoursesWhere } from "@/lib/permissions";
import { Badge, Container, PageHeader, Stat } from "@/components/ui";
import { StatusBadge } from "@/components/applications/StatusBadge";
import { formatHours } from "@/lib/labels";
import { formatDate, pct } from "@/lib/utils";

export const metadata = { title: "Espace OF" };
export const dynamic = "force-dynamic";

export default async function OfHome() {
  const user = await requireStaff();
  const manager = isOfManager(user);
  const courseWhere = manageableCoursesWhere(user);
  const courses = await db.course.findMany({ where: courseWhere, select: { id: true } });
  const ids = courses.map((c) => c.id);
  const since30 = new Date(Date.now() - 30 * 86400000);
  const [appsByStatus, recentApps, activeEnr, completedEnr, time30, logins7, pendingSubs, pendingQuiz, satisfaction, openComplaints, idle] = await Promise.all([
    db.application.groupBy({ by: ["status"], where: { courseId: { in: ids } }, _count: true }),
    manager
      ? db.application.findMany({
          where: { courseId: { in: ids }, status: { in: ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED"] } },
          orderBy: { submittedAt: "asc" },
          take: 8,
          include: { user: { select: { name: true } }, course: { select: { title: true } } },
        })
      : Promise.resolve([]),
    db.enrollment.count({ where: { courseId: { in: ids }, status: "ACTIVE" } }),
    db.enrollment.count({ where: { courseId: { in: ids }, status: "COMPLETED" } }),
    db.timeLog.aggregate({ where: { courseId: { in: ids }, startedAt: { gte: since30 } }, _sum: { seconds: true } }),
    db.loginEvent.count({ where: { type: "LOGIN", createdAt: { gte: new Date(Date.now() - 7 * 86400000) }, user: { enrollments: { some: { courseId: { in: ids } } } } } }),
    db.submission.count({ where: { status: "SUBMITTED", lesson: { module: { courseId: { in: ids } } } } }),
    db.quizAttempt.count({ where: { status: "PENDING_REVIEW", quiz: { lesson: { module: { courseId: { in: ids } } } } } }),
    db.satisfactionResponse.aggregate({ where: { enrollment: { courseId: { in: ids } } }, _avg: { globalScore: true }, _count: true }),
    db.complaint.count({ where: { status: { not: "RESOLVED" }, courseId: { in: ids } } }),
    // Apprenants actifs sans activité depuis 7 jours (décrochage)
    db.enrollment.findMany({
      where: { courseId: { in: ids }, status: "ACTIVE", OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: new Date(Date.now() - 7 * 86400000) } }] },
      take: 8,
      orderBy: { lastActivityAt: { sort: "asc", nulls: "first" } },
      include: { user: { select: { id: true, name: true } }, course: { select: { title: true } } },
    }),
  ]);
  const count = (s: string) => appsByStatus.find((a) => a.status === s)?._count ?? 0;
  return (
    <Container>
      <PageHeader
        title="Tableau de bord de l'organisme"
        subtitle="Vue d'ensemble des inscriptions, de l'assiduité et de la qualité."
        actions={
          <>
            <Link href="/of/courses/new" className="btn-primary">Créer une formation</Link>
            {manager && <Link href="/of/reports" className="btn-secondary">Rapports OPCO / France Travail</Link>}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {manager && <Stat label="Dossiers à traiter" value={count("SUBMITTED") + count("UNDER_REVIEW")} hint={`${count("INCOMPLETE")} en attente de compléments`} />}
        {manager && <Stat label="Inscriptions à finaliser" value={count("ACCEPTED")} hint="Dossiers validés" />}
        <Stat label="Apprenants en formation" value={activeEnr} hint={`${completedEnr} formation(s) terminée(s)`} />
        <Stat label="Temps de formation (30 j)" value={formatHours(time30._sum.seconds)} hint={`${logins7} connexion(s) sur 7 jours`} />
        <Stat label="À corriger" value={pendingSubs + pendingQuiz} hint={`${pendingSubs} devoir(s) · ${pendingQuiz} quiz`} />
        <Stat label="Satisfaction" value={satisfaction._avg.globalScore ? `${satisfaction._avg.globalScore.toFixed(1)} / 5` : "—"} hint={`${satisfaction._count} réponse(s)`} />
        <Stat label="Réclamations ouvertes" value={openComplaints} />
        <Stat label="Formations" value={ids.length} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {manager && (
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2>Dossiers en attente</h2>
              <Link href="/of/applications" className="link text-sm">Tout voir</Link>
            </div>
            {recentApps.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun dossier en attente</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentApps.map((a) => (
                  <li key={a.id}>
                    <Link href={`/of/applications/${a.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:text-brand-700">
                      <span>
                        <b>{a.user.name}</b> · {a.course.title}
                        <span className="block text-xs text-slate-500">{a.number} · déposé le {formatDate(a.submittedAt)}</span>
                      </span>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <section className="card p-5">
          <h2 className="mb-3">Risque de décrochage (aucune activité depuis 7 jours)</h2>
          {idle.length === 0 ? (
            <p className="text-sm text-slate-500">Tous les apprenants sont actifs.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {idle.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/of/learners/${e.user.id}`} className="hover:text-brand-700">
                    <b>{e.user.name}</b> · {e.course.title}
                  </Link>
                  <Badge tone="amber">{e.lastActivityAt ? `Dernière activité ${formatDate(e.lastActivityAt)}` : "Jamais connecté(e)"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {activeEnr + completedEnr > 0 && (
        <p className="mt-6 text-xs text-slate-500">Taux de complétion : {pct((completedEnr / (activeEnr + completedEnr)) * 100)}</p>
      )}
    </Container>
  );
}
