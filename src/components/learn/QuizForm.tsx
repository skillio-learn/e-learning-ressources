"use client";
import { useEffect, useRef, useState } from "react";
import { submitQuizAttemptAction } from "@/app/actions/learner";
import { SubmitButton } from "@/components/SubmitButton";

type QuizQuestion = {
  id: string;
  type: "SINGLE" | "MULTIPLE" | "TRUE_FALSE" | "SHORT" | "OPEN";
  textHtml: string;
  points: number;
  options: { id: string; text: string }[];
};

export function QuizForm({ attemptId, questions, deadline }: { attemptId: string; questions: QuizQuestion[]; deadline: number | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [left, setLeft] = useState<number | null>(deadline ? Math.max(0, deadline - Date.now()) : null);
  const submitted = useRef(false);

  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => {
      const l = Math.max(0, deadline - Date.now());
      setLeft(l);
      if (l === 0 && !submitted.current) {
        submitted.current = true;
        formRef.current?.requestSubmit();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const mm = left !== null ? Math.floor(left / 60000) : 0;
  const ss = left !== null ? Math.floor((left % 60000) / 1000) : 0;

  return (
    <form
      ref={formRef}
      action={submitQuizAttemptAction.bind(null, attemptId)}
      className="space-y-4"
      onSubmit={(e) => {
        if (submitted.current) return;
        if (!window.confirm("Remettre vos réponses ? Vous ne pourrez plus les modifier.")) e.preventDefault();
        else submitted.current = true;
      }}
    >
      {left !== null && (
        <div className={`sticky top-16 z-10 ml-auto w-fit rounded-full px-4 py-1.5 text-sm font-semibold shadow ${left < 60000 ? "bg-red-600 text-white" : "bg-surface text-slate-700"}`}>
          {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
        </div>
      )}
      {questions.map((q, i) => (
        <fieldset key={q.id} className="card p-5">
          <legend className="sr-only">Question {i + 1}</legend>
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="font-medium">
              <span className="text-slate-500">Q{i + 1}. </span>
              <span className="prose-lms inline [&>p]:inline" dangerouslySetInnerHTML={{ __html: q.textHtml }} />
            </div>
            <span className="shrink-0 text-xs text-slate-500">{q.points} pt</span>
          </div>
          {q.type === "MULTIPLE" && <p className="mb-2 text-xs text-slate-500">Plusieurs réponses possibles</p>}
          {(q.type === "SINGLE" || q.type === "TRUE_FALSE" || q.type === "MULTIPLE") && (
            <div className="space-y-2">
              {q.options.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                  <input type={q.type === "MULTIPLE" ? "checkbox" : "radio"} name={`q_${q.id}`} value={o.id} className="accent-brand-600" />
                  <span className="text-sm">{o.text}</span>
                </label>
              ))}
            </div>
          )}
          {q.type === "SHORT" && <input name={`t_${q.id}`} className="input" placeholder="Votre réponse" autoComplete="off" />}
          {q.type === "OPEN" && (
            <textarea name={`t_${q.id}`} rows={6} className="input" placeholder="Rédigez votre réponse (corrigée par le formateur)" />
          )}
        </fieldset>
      ))}
      <div className="flex justify-end">
        <SubmitButton className="btn-primary" pendingLabel="Correction…">Remettre mes réponses</SubmitButton>
      </div>
    </form>
  );
}
