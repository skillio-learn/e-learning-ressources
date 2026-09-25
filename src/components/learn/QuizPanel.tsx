import Link from "next/link";
import { db } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { shuffle } from "@/lib/quiz";
import { formatDate, pct } from "@/lib/utils";
import { startQuizAttemptAction } from "@/app/actions/learner";
import { SubmitButton } from "@/components/SubmitButton";
import { AttemptReview } from "@/components/quiz/AttemptReview";
import { QuizForm } from "./QuizForm";
import { Badge } from "@/components/ui";

export async function QuizPanel({
  lessonId,
  userId,
  preview,
  attemptId,
  slug,
}: {
  lessonId: string;
  userId: string;
  preview: boolean;
  attemptId?: string;
  slug: string;
}) {
  const quiz = await db.quiz.findUnique({
    where: { lessonId },
    include: { questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } } },
  });
  if (!quiz) return <div className="card p-6 text-slate-500">Ce quiz n&apos;est pas encore configuré.</div>;

  const attempts = await db.quizAttempt.findMany({
    where: { quizId: quiz.id, userId },
    orderBy: { startedAt: "desc" },
  });
  const inProgress = attempts.find((a) => a.status === "IN_PROGRESS");
  const done = attempts.filter((a) => a.status !== "IN_PROGRESS");
  const remaining = quiz.maxAttempts ? quiz.maxAttempts - attempts.length : null;
  const best = done.reduce<number | null>((m, a) => (m === null || a.percent > m ? a.percent : m), null);
  const totalPoints = quiz.questions.reduce((s, q) => s + q.points, 0);

  // Affichage du résultat d'une tentative
  const shown = attemptId ? done.find((a) => a.id === attemptId) : null;
  if (shown) {
    const answers = await db.answer.findMany({ where: { attemptId: shown.id } });
    const canRetry = !shown.passed && (remaining === null || remaining > 0);
    return (
      <div className="space-y-4">
        <div
          className={`card p-6 ${shown.status === "PENDING_REVIEW" ? "bg-amber-50" : shown.passed ? "bg-emerald-50" : "bg-red-50"}`}
        >
          <div className="text-sm font-medium text-slate-600">Résultat de votre tentative</div>
          <div className="mt-1 text-4xl font-extrabold">{pct(shown.percent)}</div>
          <div className="mt-1 text-sm text-slate-600">
            {shown.score} / {shown.maxScore} points · seuil de réussite {quiz.passingScore} %
          </div>
          <div className="mt-3 font-semibold">
            {shown.status === "PENDING_REVIEW"
              ? "Certaines réponses doivent être corrigées par votre formateur. Vous pouvez poursuivre le parcours."
              : shown.passed
                ? "Bravo, quiz réussi !"
                : "Quiz non validé."}
          </div>
          {shown.feedback && <p className="mt-2 text-sm">{shown.feedback}</p>}
          <div className="mt-4 flex gap-2">
            <Link href={`/learn/${slug}/${lessonId}`} className="btn-secondary">Retour au quiz</Link>
            <a href={`/api/pdf/attempts/${shown.id}`} className="btn-secondary">Mes résultats (PDF)</a>
            {canRetry && (
              <form action={startQuizAttemptAction.bind(null, quiz.id)}>
                <SubmitButton className="btn-primary">Nouvelle tentative</SubmitButton>
              </form>
            )}
          </div>
        </div>
        {quiz.showCorrection ? (
          <AttemptReview questions={quiz.questions} answers={answers} showCorrection />
        ) : (
          <p className="text-sm text-slate-500">La correction détaillée n&apos;est pas affichée pour ce quiz.</p>
        )}
      </div>
    );
  }

  if (inProgress && !preview) {
    const questions = quiz.shuffleQuestions ? shuffle(quiz.questions, inProgress.id) : quiz.questions;
    const deadline = quiz.timeLimitMin ? inProgress.startedAt.getTime() + quiz.timeLimitMin * 60_000 : null;
    return (
      <QuizForm
        attemptId={inProgress.id}
        deadline={deadline}
        questions={questions.map((q) => ({
          id: q.id,
          type: q.type,
          textHtml: renderMarkdown(q.text),
          points: q.points,
          options: q.options.map((o) => ({ id: o.id, text: o.text })),
        }))}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        {quiz.instructions && (
          <div className="prose-lms mb-4" dangerouslySetInnerHTML={{ __html: renderMarkdown(quiz.instructions) }} />
        )}
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge tone="blue">{quiz.questions.length} question(s)</Badge>
          <Badge>{totalPoints} point(s)</Badge>
          <Badge>Réussite : {quiz.passingScore} %</Badge>
          {quiz.timeLimitMin && <Badge tone="amber">{quiz.timeLimitMin} min</Badge>}
          <Badge>{quiz.maxAttempts ? `${quiz.maxAttempts} tentative(s) max` : "Tentatives illimitées"}</Badge>
          {!quiz.graded && <Badge tone="purple">Auto-évaluation (non notée)</Badge>}
        </div>
        {best !== null && <p className="mt-4 text-sm">Meilleur score : <b>{pct(best)}</b></p>}
        <div className="mt-5">
          {preview ? (
            <p className="text-sm text-amber-700">Mode aperçu : le formateur ne peut pas passer le quiz. Voir les questions dans l&apos;éditeur.</p>
          ) : remaining !== null && remaining <= 0 ? (
            <p className="text-sm text-red-600">Vous avez utilisé toutes vos tentatives. Contactez votre formateur si besoin.</p>
          ) : quiz.questions.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune question pour le moment.</p>
          ) : (
            <form action={startQuizAttemptAction.bind(null, quiz.id)}>
              <SubmitButton className="btn-primary" pendingLabel="Préparation…">
                {done.length ? "Recommencer le quiz" : "Commencer le quiz"}
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      {done.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>#</th><th>Date</th><th>Score</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {done.map((a, i) => (
                <tr key={a.id}>
                  <td>{done.length - i}</td>
                  <td>{formatDate(a.submittedAt, true)}</td>
                  <td className="font-semibold">{pct(a.percent)}</td>
                  <td>{a.status === "PENDING_REVIEW" ? "En correction" : a.passed ? "Réussi" : "Non validé"}</td>
                  <td className="text-right">
                    <Link href={`/learn/${slug}/${lessonId}?attempt=${a.id}`} className="text-brand-600 hover:underline">Détail</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
