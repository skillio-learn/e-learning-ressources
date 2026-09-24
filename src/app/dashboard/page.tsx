import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { manageableCoursesWhere } from "@/lib/permissions";
import { getCourseOutline } from "@/lib/progress";
import { Container, Empty, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { formatDate, pct } from "@/lib/utils";

export const metadata = { title: "Tableau de bord" };
export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  return (
    <Container>
      {denied && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Vous n&apos;avez pas les droits nécessaires pour accéder à cette page.
        </p>
      )}
      <PageHeader title={`Bonjour ${user.name.split(" ")[0]} 👋`} subtitle="Voici un aperçu de votre activité." />
      {user.role === "LEARNER" ? <LearnerDashboard userId={user.id} /> : <StaffDashboard user={user} />}
    </Container>
  );
}

async function LearnerDashboard({ userId }: { userId: string }) {
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
  const withProgress = await Promise.all(
    enrollments.map(async (e) => ({ e, outline: await getCourseOutline(e.course.id, userId) })),
  );
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Formations en cours" value={enrollments.filter((e) => e.status === "ACTIVE").length} />
        <Stat label="Formations terminées" value={enrollments.filter((e) => e.status === "COMPLETED").length} />
        <Stat label="Certificats obtenus" value={certificates} />
      </div>
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
                  {outline?.next ? <>Prochaine étape : <b>{outline.next.title}</b></> : "Toutes les étapes sont terminées 🎉"}
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
                    <td>{a.status === "PENDING_REVIEW" ? "⏳ En correction" : a.passed ? "✅ Réussi" : "❌ Non validé"}</td>
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

async function StaffDashboard({ user }: { user: { id: string; role: "ADMIN" | "TRAINER" | "LEARNER"; email: string; name: string; active: boolean } }) {
  const where = manageableCoursesWhere(user);
  const courses = await db.course.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { enrollments: true, modules: true } } },
  });
  const courseIds = courses.map((c) => c.id);
  const [learners, pendingSubs, pendingQuiz, completions, users] = await Promise.all([
    db.enrollment.count({ where: { courseId: { in: courseIds } } }),
    db.submission.count({ where: { status: "SUBMITTED", lesson: { module: { courseId: { in: courseIds } } } } }),
    db.quizAttempt.count({ where: { status: "PENDING_REVIEW", quiz: { lesson: { module: { courseId: { in: courseIds } } } } } }),
    db.enrollment.count({ where: { courseId: { in: courseIds }, status: "COMPLETED" } }),
    user.role === "ADMIN" ? db.user.count() : Promise.resolve(null),
  ]);
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Formations" value={courses.length} hint={`${courses.filter((c) => c.status === "PUBLISHED").length} publiée(s)`} />
        <Stat label="Inscriptions" value={learners} hint={`${completions} terminée(s)`} />
        <Stat label="À corriger" value={pendingSubs + pendingQuiz} hint={`${pendingSubs} devoir(s) · ${pendingQuiz} quiz`} />
        {users !== null ? <Stat label="Utilisateurs" value={users} /> : <Stat label="Taux de réussite" value={learners ? pct((completions / learners) * 100) : "—"} />}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/trainer/courses/new" className="btn-primary">+ Nouvelle formation</Link>
        <Link href="/trainer/rubrics/new" className="btn-secondary">+ Nouvelle grille d&apos;évaluation</Link>
        <Link href="/trainer/grading" className="btn-secondary">Corrections en attente</Link>
        {user.role === "ADMIN" && <Link href="/admin/users" className="btn-secondary">Gérer les utilisateurs</Link>}
      </div>
      <section>
        <h2 className="mb-3">Mes formations</h2>
        {courses.length === 0 ? (
          <Empty title="Aucune formation">Créez votre première formation pour commencer.</Empty>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Formation</th><th>Statut</th><th>Modules</th><th>Inscrits</th><th>Mise à jour</th><th></th></tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.title}</td>
                    <td>{c.status === "PUBLISHED" ? "🟢 Publiée" : c.status === "DRAFT" ? "🟡 Brouillon" : "⚪ Archivée"}</td>
                    <td>{c._count.modules}</td>
                    <td>{c._count.enrollments}</td>
                    <td>{formatDate(c.updatedAt)}</td>
                    <td className="text-right">
                      <Link href={`/trainer/courses/${c.id}`} className="text-brand-600 hover:underline">Gérer</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
