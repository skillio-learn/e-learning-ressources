import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCourseOutline, getLearnerResults } from "@/lib/progress";
import { forceCompleteLessonAction, resetQuizAttemptsAction } from "@/app/actions/of";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Stat } from "@/components/ui";
import { formatDate, pct } from "@/lib/utils";
import { LessonTypeIcon } from "@/components/LessonTypeIcon";

export const dynamic = "force-dynamic";

export default async function LearnerDetail({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: id } },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!enrollment) notFound();
  const [outline, { results, average }, progress, certificate, quizzes] = await Promise.all([
    getCourseOutline(id, userId, { ignoreLocks: true }),
    getLearnerResults(userId, id),
    db.lessonProgress.findMany({ where: { userId, lesson: { module: { courseId: id } } } }),
    db.certificate.findUnique({ where: { userId_courseId: { userId, courseId: id } } }),
    db.quiz.findMany({ where: { lesson: { module: { courseId: id } } }, select: { id: true, lessonId: true } }),
  ]);
  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
  const quizByLesson = new Map(quizzes.map((q) => [q.lessonId, q.id]));
  const resultByLesson = new Map(results.map((r) => [r.lessonId, r]));
  const totalTime = progress.reduce((s, p) => s + p.timeSpentSec, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/of/courses/${id}/learners`} className="text-sm text-slate-500 hover:text-brand-600">← Apprenants</Link>
          <h2 className="mt-1 text-xl">{enrollment.user.name}</h2>
          <div className="text-sm text-slate-500">{enrollment.user.email} · inscrit le {formatDate(enrollment.enrolledAt)}</div>
        </div>
        {certificate && <Link href={`/certificates/${certificate.code}`} className="btn-secondary">Certificat</Link>}
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Progression" value={`${outline?.percent ?? 0} %`} />
        <Stat label="Moyenne" value={pct(average)} />
        <Stat label="Temps passé" value={`${Math.round(totalTime / 60)} min`} />
        <Stat label="Statut" value={enrollment.status === "COMPLETED" ? "Validée" : enrollment.status === "SUSPENDED" ? "Suspendu" : "En cours"} />
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Étape</th><th>Statut</th><th>Score</th><th>Temps</th><th>Terminée le</th><th></th></tr>
          </thead>
          <tbody>
            {outline?.modules.map((m, mi) => (
              <Fragment key={m.id}>
                <tr><td colSpan={6} className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">Module {mi + 1} · {m.title}</td></tr>
                {m.lessons.map((l) => {
                  const p = byLesson.get(l.id);
                  const r = resultByLesson.get(l.id);
                  const quizId = quizByLesson.get(l.id);
                  return (
                    <tr key={l.id}>
                      <td><span className="inline-flex items-center gap-2"><LessonTypeIcon type={l.type} /> {l.title}</span></td>
                      <td>
                        {l.completed ? <Badge tone="green">Terminée</Badge> : p ? <Badge tone="blue">Commencée</Badge> : <Badge>Non commencée</Badge>}
                        {r?.pending && <Badge tone="amber">À corriger</Badge>}
                      </td>
                      <td>
                        {r ? (
                          r.refId ? (
                            <Link className="text-brand-600 hover:underline" href={r.kind === "QUIZ" ? `/of/grading/attempts/${r.refId}` : `/of/grading/submissions/${r.refId}`}>
                              {pct(r.percent)}
                            </Link>
                          ) : "—"
                        ) : p?.score != null ? pct(p.score) : "—"}
                      </td>
                      <td className="text-xs">{p ? `${Math.round(p.timeSpentSec / 60)} min` : "—"}</td>
                      <td className="text-xs text-slate-500">{formatDate(p?.completedAt)}</td>
                      <td className="whitespace-nowrap text-right">
                        {!l.completed && l.type !== "QUIZ" && l.type !== "ASSIGNMENT" && (
                          <form action={forceCompleteLessonAction.bind(null, id, userId, l.id)} className="inline">
                            <button className="btn-ghost btn-sm" title="Valider manuellement">✓ Valider</button>
                          </form>
                        )}
                        {quizId && r && r.attempts > 0 && (
                          <form action={resetQuizAttemptsAction.bind(null, id, userId, quizId)} className="inline">
                            <SubmitButton className="btn-ghost btn-sm" pendingLabel="…" confirm="Supprimer toutes les tentatives de cet apprenant sur ce quiz ?">
                              ↺ Réinit. tentatives
                            </SubmitButton>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
