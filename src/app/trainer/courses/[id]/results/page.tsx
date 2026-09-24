import Link from "next/link";
import { db } from "@/lib/db";
import { getGradebook } from "@/lib/gradebook";
import { Badge, Empty } from "@/components/ui";
import { pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CourseResults({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { evaluations, rows } = await getGradebook(id);
  const quizzes = await db.quiz.findMany({
    where: { lesson: { module: { courseId: id } } },
    orderBy: [{ lesson: { module: { position: "asc" } } }, { lesson: { position: "asc" } }],
    include: {
      lesson: { select: { title: true } },
      questions: {
        orderBy: { position: "asc" },
        include: { answers: { where: { attempt: { status: { not: "IN_PROGRESS" } } }, select: { pointsAwarded: true, isCorrect: true, needsReview: true } } },
      },
    },
  });
  const base = `/api/trainer/courses/${id}/export`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <a href={`${base}/gradebook`} className="btn-primary">⬇ Carnet de notes (CSV)</a>
        <a href={`${base}/attempts`} className="btn-secondary">⬇ Réponses détaillées aux quiz (CSV)</a>
        <a href={`${base}/rubrics`} className="btn-secondary">⬇ Grilles d&apos;évaluation remplies (CSV)</a>
        <Link href={`/trainer/grading?course=${id}`} className="btn-secondary">📝 Corrections de cette formation</Link>
      </div>

      <section>
        <h2 className="mb-3">Carnet de notes</h2>
        {rows.length === 0 ? (
          <Empty title="Aucun apprenant inscrit" />
        ) : (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-slate-50">Apprenant</th>
                  <th>Progression</th>
                  {evaluations.map((e) => (
                    <th key={e.id} className="min-w-[110px] normal-case" title={e.title}>
                      {e.type === "QUIZ" ? "❓" : "📝"} {e.title.length > 24 ? e.title.slice(0, 22) + "…" : e.title}
                    </th>
                  ))}
                  <th>Moyenne</th>
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user.id}>
                    <td className="sticky left-0 bg-white">
                      <Link href={`/trainer/courses/${id}/learners/${r.user.id}`} className="font-medium hover:text-brand-700">{r.user.name}</Link>
                    </td>
                    <td>{r.progress} %</td>
                    {evaluations.map((e) => {
                      const res = r.byLesson.get(e.id);
                      if (!res || res.attempts === 0) return <td key={e.id} className="text-slate-300">—</td>;
                      const href = res.refId ? (res.kind === "QUIZ" ? `/trainer/grading/attempts/${res.refId}` : `/trainer/grading/submissions/${res.refId}`) : "#";
                      return (
                        <td key={e.id}>
                          <Link href={href} className={res.pending ? "text-amber-600" : res.passed ? "text-emerald-700" : "text-red-600"}>
                            {res.pending ? "⏳ " : ""}{pct(res.percent)}
                          </Link>
                        </td>
                      );
                    })}
                    <td className="font-semibold">{pct(r.average)}</td>
                    <td>{r.status === "COMPLETED" ? <Badge tone="green">Validée</Badge> : <Badge>En cours</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {quizzes.length > 0 && (
        <section className="space-y-4">
          <h2>Analyse des quiz (taux de réussite par question)</h2>
          {quizzes.map((q) => (
            <details key={q.id} className="card p-4">
              <summary className="cursor-pointer font-semibold">❓ {q.lesson.title}</summary>
              <table className="table mt-3">
                <thead>
                  <tr><th>Question</th><th>Réponses</th><th>Réussite</th><th>Score moyen</th></tr>
                </thead>
                <tbody>
                  {q.questions.map((qq, i) => {
                    const graded = qq.answers.filter((a) => !a.needsReview);
                    const ok = graded.filter((a) => a.isCorrect).length;
                    const avg = graded.length ? graded.reduce((s, a) => s + a.pointsAwarded, 0) / graded.length : null;
                    const rate = graded.length ? (ok / graded.length) * 100 : null;
                    return (
                      <tr key={qq.id}>
                        <td className="max-w-md"><span className="text-slate-400">Q{i + 1}.</span> {qq.text}</td>
                        <td>{qq.answers.length}</td>
                        <td>
                          <span className={rate === null ? "" : rate < 50 ? "font-semibold text-red-600" : "text-emerald-700"}>{pct(rate)}</span>
                        </td>
                        <td>{avg === null ? "—" : `${Math.round(avg * 100) / 100} / ${qq.points}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
