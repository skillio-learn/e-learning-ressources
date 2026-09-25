import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCourseOutline } from "@/lib/progress";
import { Container, Empty, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { formatDate, pct } from "@/lib/utils";
import { ACCESS_STATUS, APPLICATION_STATUS } from "@/lib/labels";
import { Badge } from "@/components/ui";

export const metadata = { title: "Tableau de bord" };
export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  if (user.role !== "LEARNER" && !denied) redirect("/of");
  return (
    <Container>
      {denied && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Vous n&apos;avez pas les droits nécessaires pour accéder à cette page.
        </p>
      )}
      <PageHeader title={`Bonjour ${user.name.split(" ")[0]}`} subtitle="Voici un aperçu de votre activité." />
      <LearnerDashboard userId={user.id} />
    </Container>
  );
}

async function LearnerDashboard({ userId }: { userId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [applications, todaySlots] = await Promise.all([
    db.application.findMany({
      where: { userId, status: { notIn: ["ENROLLED", "WITHDRAWN"] } },
      orderBy: { updatedAt: "desc" },
      include: { course: { select: { title: true } } },
    }),
    db.attendanceSlot.findMany({
      where: {
        date: { gte: new Date(today), lt: new Date(new Date(today).getTime() + 86400000) },
        session: { enrollments: { some: { userId } } },
        signatures: { none: { userId } },
      },
      select: { id: true },
    }),
  ]);
  const [enrollments, certificates, attempts] = await Promise.all([
    db.enrollment.findMany({
      where: { userId, status: { not: "SUSPENDED" } },
      include: { course: { select: { id: true, slug: true, title: true } } },
      orderBy: [{ lastActivityAt: { sort: "desc", nulls: "last" } }, { enrolledAt: "desc" }],
    }),
    db.certificate.count({ where: { userId } }),
    db.quizAttempt.findMany({
      where: { userId, status: { not: "IN_PROGRESS" } },
      orderBy: { submittedAt: "desc" },
      take: 5,
      include: { quiz: { select: { lesson: { select: { title: true, module: { select: { course: { select: { title: true } } } } } } } } },
    }),
  ]);
  const pendingAccess = enrollments.filter((e) => e.accessStatus !== "GRANTED");
  const withProgress = await Promise.all(
    enrollments.filter((e) => e.accessStatus === "GRANTED").map(async (e) => ({ e, outline: await getCourseOutline(e.course.id, userId) })),
  );
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Formations en cours" value={enrollments.filter((e) => e.status === "ACTIVE").length} />
        <Stat label="Formations terminées" value={enrollments.filter((e) => e.status === "COMPLETED").length} />
        <Stat label="Certificats obtenus" value={certificates} />
      </div>
      {todaySlots.length > 0 && (
        <Link href="/attendance" className="block rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 hover:shadow">
          Vous avez <b>{todaySlots.length}</b> émargement(s) à signer aujourd&apos;hui → Signer maintenant
        </Link>
      )}
      {pendingAccess.length > 0 && (
        <section>
          <h2 className="mb-3">Inscriptions à finaliser</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {pendingAccess.map((e) => (
              <Link key={e.id} href={`/enrollments/${e.id}`} className="card card-hover flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-medium text-slate-900">{e.course.title}</div>
                  <div className="text-xs text-slate-500">
                    {e.accessStatus === "PENDING_DOCUMENTS" ? "Signez ou déposez vos documents d'inscription" : e.accessStatus === "UNDER_REVIEW" ? "L'organisme vérifie vos documents" : e.accessDecisionNote ?? "Accès refusé"}
                  </div>
                </div>
                <Badge tone={ACCESS_STATUS[e.accessStatus].tone}>{ACCESS_STATUS[e.accessStatus].label}</Badge>
              </Link>
            ))}
          </div>
        </section>
      )}
      {applications.length > 0 && (
        <section>
          <h2 className="mb-3">Mes dossiers de candidature</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {applications.map((a) => (
              <Link key={a.id} href={`/applications/${a.id}`} className="card flex items-center justify-between gap-3 p-4 hover:shadow-md">
                <div>
                  <div className="text-xs text-slate-400">{a.number}</div>
                  <div className="font-medium">{a.course.title}</div>
                </div>
                <Badge tone={APPLICATION_STATUS[a.status].tone}>{APPLICATION_STATUS[a.status].label}</Badge>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section>
        <h2 className="mb-3">Reprendre mes formations</h2>
        {withProgress.length === 0 ? (
          <Empty title="Aucune formation pour le moment">
            <Link href="/courses" className="text-brand-600 hover:underline">Parcourir le catalogue</Link>
          </Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {withProgress.map(({ e, outline }) => (
              <div key={e.id} className="card flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold">{e.course.title}</div>
                  <span className="text-sm font-semibold text-brand-700">{outline?.percent ?? 0} %</span>
                </div>
                <ProgressBar value={outline?.percent ?? 0} />
                <div className="text-sm text-slate-500">
                  {outline?.next ? <>Prochaine étape : <b>{outline.next.title}</b></> : "Toutes les étapes sont terminées"}
                </div>
                <Link
                  href={outline?.next ? `/learn/${e.course.slug}/${outline.next.id}` : `/learn/${e.course.slug}`}
                  className="btn-primary self-start"
                >
                  {outline?.completed ? "Continuer" : "Commencer"}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
      {attempts.length > 0 && (
        <section>
          <h2 className="mb-3">Derniers résultats</h2>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Quiz</th><th>Formation</th><th>Date</th><th>Score</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.quiz.lesson.title}</td>
                    <td className="text-slate-500">{a.quiz.lesson.module.course.title}</td>
                    <td>{formatDate(a.submittedAt, true)}</td>
                    <td className="font-semibold">{pct(a.percent)}</td>
                    <td>{a.status === "PENDING_REVIEW" ? "En correction" : a.passed ? "Réussi" : "Non validé"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
