import type { Answer, Question, QuestionOption } from "@prisma/client";
import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

type Q = Question & { options: QuestionOption[] };

/** Affiche une tentative corrigée : réponses de l'apprenant, bonnes réponses, points et commentaires. */
export function AttemptReview({
  questions,
  answers,
  showCorrection,
  renderExtra,
}: {
  questions: Q[];
  answers: Answer[];
  showCorrection: boolean;
  renderExtra?: (q: Q, a: Answer | undefined) => React.ReactNode;
}) {
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  return (
    <ol className="space-y-4">
      {questions.map((q, i) => {
        const a = byQ.get(q.id);
        const status = a?.needsReview ? "review" : a?.isCorrect ? "ok" : a && a.pointsAwarded > 0 ? "partial" : "ko";
        return (
          <li
            key={q.id}
            className={cn(
              "card border-l-4 p-5",
              status === "ok" && "border-l-emerald-500",
              status === "partial" && "border-l-amber-400",
              status === "ko" && "border-l-red-400",
              status === "review" && "border-l-slate-300",
            )}
          >
            <div className="mb-2 flex items-start justify-between gap-4">
              <div className="font-medium">
                <span className="text-slate-400">Q{i + 1}. </span>
                <span className="prose-lms inline [&>p]:inline" dangerouslySetInnerHTML={{ __html: renderMarkdown(q.text) }} />
              </div>
              <span className="shrink-0 text-sm font-semibold text-slate-600">
                {a?.needsReview ? "À corriger" : `${a?.pointsAwarded ?? 0} / ${q.points} pt`}
              </span>
            </div>

            {q.options.length > 0 && (
              <ul className="space-y-1.5">
                {q.options.map((o) => {
                  const chosen = a?.selectedOptionIds.includes(o.id);
                  return (
                    <li
                      key={o.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm",
                        showCorrection && o.isCorrect && "bg-emerald-50 text-emerald-900",
                        chosen && !o.isCorrect && showCorrection && "bg-red-50 text-red-900",
                        chosen && !showCorrection && "bg-slate-100",
                      )}
                    >
                      <span className="w-4">{chosen ? (q.type === "MULTIPLE" ? "☑" : "◉") : q.type === "MULTIPLE" ? "☐" : "○"}</span>
                      <span className="flex-1">{o.text}</span>
                      {showCorrection && o.isCorrect && <span className="text-xs font-medium">Bonne réponse</span>}
                    </li>
                  );
                })}
              </ul>
            )}

            {(q.type === "SHORT" || q.type === "OPEN") && (
              <div className="rounded-md bg-slate-50 p-3 text-sm whitespace-pre-wrap">
                {a?.text || <span className="italic text-slate-400">Pas de réponse</span>}
              </div>
            )}
            {showCorrection && q.type === "SHORT" && q.acceptedAnswers.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">Réponse(s) attendue(s) : {q.acceptedAnswers.join(" · ")}</p>
            )}
            {showCorrection && q.explanation && (
              <div className="mt-3 rounded-md bg-brand-50 p-3 text-sm text-brand-900">
                <span className="font-semibold text-amber-600">Explication :</span> <span className="prose-lms [&>p]:inline" dangerouslySetInnerHTML={{ __html: renderMarkdown(q.explanation) }} />
              </div>
            )}
            {a?.feedback && (
              <div className="mt-3 rounded-md bg-violet-50 p-3 text-sm text-violet-900">
                <b>Commentaire du formateur :</b> {a.feedback}
              </div>
            )}
            {renderExtra?.(q, a)}
          </li>
        );
      })}
    </ol>
  );
}
