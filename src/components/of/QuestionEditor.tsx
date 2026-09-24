"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteQuestionAction, moveQuestionAction, saveQuestionAction, type QuestionInput } from "@/app/actions/of";
import { QUESTION_TYPE_LABELS } from "@/lib/utils";

type QType = keyof typeof QUESTION_TYPE_LABELS;
export type EditableQuestion = {
  id: string;
  type: QType;
  text: string;
  explanation: string | null;
  points: number;
  acceptedAnswers: string[];
  options: { text: string; isCorrect: boolean }[];
};

const blank = (): QuestionInput => ({
  type: "SINGLE",
  text: "",
  explanation: "",
  points: 1,
  acceptedAnswers: [],
  options: [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ],
});

export function QuestionEditor({ quizId, questions }: { quizId: string; questions: EditableQuestion[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(questions.length ? null : "new");
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-3">
      {questions.map((q, i) =>
        editing === q.id ? (
          <QuestionForm key={q.id} quizId={quizId} initial={{ ...q }} onDone={() => setEditing(null)} />
        ) : (
          <div key={q.id} className="card flex items-start gap-3 p-4">
            <span className="mt-0.5 text-sm font-semibold text-slate-400">Q{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{q.text}</div>
              <div className="mt-1 text-xs text-slate-500">
                {QUESTION_TYPE_LABELS[q.type]} · {q.points} pt
              </div>
              {q.options.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-sm">
                  {q.options.map((o, j) => (
                    <li key={j} className={o.isCorrect ? "font-medium text-emerald-700" : "text-slate-600"}>
                      {o.isCorrect ? "✓" : "·"} {o.text}
                    </li>
                  ))}
                </ul>
              )}
              {q.type === "SHORT" && <div className="mt-2 text-sm text-emerald-700">Réponses acceptées : {q.acceptedAnswers.join(" · ") || "—"}</div>}
            </div>
            <div className="flex shrink-0 gap-0.5">
              <button className="btn-ghost btn-sm" disabled={pending || i === 0} onClick={() => start(async () => { await moveQuestionAction(q.id, -1); router.refresh(); })}>↑</button>
              <button className="btn-ghost btn-sm" disabled={pending || i === questions.length - 1} onClick={() => start(async () => { await moveQuestionAction(q.id, 1); router.refresh(); })}>↓</button>
              <button className="btn-ghost btn-sm" onClick={() => setEditing(q.id)}>Modifier</button>
              <button
                className="btn-ghost btn-sm text-red-600"
                disabled={pending}
                onClick={() => {
                  if (confirm("Supprimer cette question ?")) start(async () => { await deleteQuestionAction(q.id); router.refresh(); });
                }}
              >
                🗑
              </button>
            </div>
          </div>
        ),
      )}
      {editing === "new" ? (
        <QuestionForm quizId={quizId} initial={blank()} onDone={() => setEditing(null)} />
      ) : (
        <button className="btn-primary" onClick={() => setEditing("new")}>+ Ajouter une question</button>
      )}
    </div>
  );
}

function QuestionForm({ quizId, initial, onDone }: { quizId: string; initial: QuestionInput; onDone: () => void }) {
  const [q, setQ] = useState<QuestionInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (patch: Partial<QuestionInput>) => setQ((prev) => ({ ...prev, ...patch }));

  const changeType = (type: QType) => {
    if (type === "TRUE_FALSE") set({ type, options: [{ text: "Vrai", isCorrect: true }, { text: "Faux", isCorrect: false }] });
    else if ((type === "SINGLE" || type === "MULTIPLE") && q.options.length < 2)
      set({ type, options: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] });
    else set({ type });
  };

  const save = () =>
    start(async () => {
      try {
        setError(null);
        await saveQuestionAction(quizId, q);
        router.refresh();
        onDone();
      } catch (e) {
        setError((e as Error).message);
      }
    });

  return (
    <div className="card space-y-4 border-brand-300 p-5 ring-2 ring-brand-100">
      <div className="grid gap-3 md:grid-cols-[1fr_120px]">
        <label className="block">
          <span className="label">Type de question</span>
          <select className="input" value={q.type} onChange={(e) => changeType(e.target.value as QType)}>
            {(Object.keys(QUESTION_TYPE_LABELS) as QType[]).map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Points</span>
          <input type="number" min="0" step="0.5" className="input" value={q.points} onChange={(e) => set({ points: Number(e.target.value) })} />
        </label>
      </div>
      <label className="block">
        <span className="label">Énoncé</span>
        <textarea className="input" rows={3} value={q.text} onChange={(e) => set({ text: e.target.value })} />
      </label>

      {(q.type === "SINGLE" || q.type === "MULTIPLE") && (
        <div className="space-y-2">
          <span className="label">Propositions (cochez la ou les bonnes réponses)</span>
          {q.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={q.type === "SINGLE" ? "radio" : "checkbox"}
                checked={o.isCorrect}
                className="accent-emerald-600"
                onChange={(e) =>
                  set({
                    options: q.options.map((x, j) =>
                      q.type === "SINGLE" ? { ...x, isCorrect: j === i } : j === i ? { ...x, isCorrect: e.target.checked } : x,
                    ),
                  })
                }
              />
              <input
                className="input"
                value={o.text}
                placeholder={`Proposition ${i + 1}`}
                onChange={(e) => set({ options: q.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
              />
              <button type="button" className="btn-ghost btn-sm" onClick={() => set({ options: q.options.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn-secondary btn-sm" onClick={() => set({ options: [...q.options, { text: "", isCorrect: false }] })}>
            + Proposition
          </button>
        </div>
      )}

      {q.type === "TRUE_FALSE" && (
        <div className="flex gap-4">
          {["Vrai", "Faux"].map((label, i) => (
            <label key={label} className="flex items-center gap-2">
              <input
                type="radio"
                checked={q.options[i]?.isCorrect ?? false}
                onChange={() => set({ options: [{ text: "Vrai", isCorrect: i === 0 }, { text: "Faux", isCorrect: i === 1 }] })}
                className="accent-emerald-600"
              />
              {label} est la bonne réponse
            </label>
          ))}
        </div>
      )}

      {q.type === "SHORT" && (
        <label className="block">
          <span className="label">Réponses acceptées (une par ligne)</span>
          <textarea
            className="input"
            rows={3}
            value={(q.acceptedAnswers ?? []).join("\n")}
            onChange={(e) => set({ acceptedAnswers: e.target.value.split("\n") })}
          />
          <span className="hint block">Comparaison sans tenir compte des majuscules, accents et ponctuation.</span>
        </label>
      )}

      {q.type === "OPEN" && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Question ouverte : la réponse sera à corriger dans « Corrections ». Utilisez l&apos;explication pour noter les éléments attendus.
        </p>
      )}

      <label className="block">
        <span className="label">Explication / correction (affichée après la remise)</span>
        <textarea className="input" rows={2} value={q.explanation ?? ""} onChange={(e) => set({ explanation: e.target.value })} />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" onClick={save} disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer la question"}</button>
        <button className="btn-ghost" onClick={onDone}>Annuler</button>
      </div>
    </div>
  );
}
