"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteQuestionAction, moveQuestionAction, saveQuestionAction, type QuestionInput } from "@/app/actions/of";
import { QUESTION_TYPE_LABELS } from "@/lib/utils";
import { Trash2 } from "lucide-react";

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
            <span className="mt-0.5 text-sm font-semibold text-slate-500">Q{i + 1}</span>
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
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ),
      )}
      {editing === "new" ? (
        <QuestionForm quizId={quizId} initial={blank()} onDone={() => setEditing(null)} />
      ) : (
        <button className="btn-primary" onClick={() => setEditing("new")}>Ajouter une question</button>
      )}
    </div>
  );
}

type Mode = "CLOSED" | "OPEN" | "TRUE_FALSE" | "SHORT";
const MODES: { key: Mode; label: string; hint: string }[] = [
  { key: "CLOSED", label: "Question fermée", hint: "Choix parmi des propositions, correction automatique" },
  { key: "OPEN", label: "Question ouverte", hint: "Réponse rédigée, corrigée par le formateur" },
  { key: "TRUE_FALSE", label: "Vrai / Faux", hint: "Deux propositions" },
  { key: "SHORT", label: "Réponse courte", hint: "Un mot ou une expression, correction automatique" },
];
const modeOf = (t: QType): Mode => (t === "SINGLE" || t === "MULTIPLE" ? "CLOSED" : t);

function QuestionForm({ quizId, initial, onDone }: { quizId: string; initial: QuestionInput; onDone: () => void }) {
  const [q, setQ] = useState<QuestionInput>(initial);
  const [mode, setMode] = useState<Mode>(modeOf(initial.type as QType));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (patch: Partial<QuestionInput>) => setQ((prev) => ({ ...prev, ...patch }));

  const changeMode = (m: Mode) => {
    setMode(m);
    if (m === "TRUE_FALSE") set({ type: "TRUE_FALSE", options: [{ text: "Vrai", isCorrect: true }, { text: "Faux", isCorrect: false }] });
    else if (m === "CLOSED") {
      const opts = q.type === "SINGLE" || q.type === "MULTIPLE" ? q.options : [];
      set({ type: "SINGLE", options: opts.length >= 2 ? opts : [{ text: "", isCorrect: true }, { text: "", isCorrect: false }, { text: "", isCorrect: false }] });
    } else set({ type: m });
  };

  /** Nombre de propositions choisi par l'OF (2 à 10) */
  const setChoiceCount = (n: number) => {
    const count = Math.max(2, Math.min(10, Math.round(n) || 2));
    const opts = q.options.slice(0, count);
    while (opts.length < count) opts.push({ text: "", isCorrect: false });
    if (!opts.some((o) => o.isCorrect)) opts[0] = { ...opts[0], isCorrect: true };
    set({ options: opts });
  };

  const correctCount = q.options.filter((o) => o.isCorrect).length;

  const save = () =>
    start(async () => {
      try {
        setError(null);
        // Question fermée : une seule bonne réponse → choix unique, plusieurs → choix multiples
        const type: QType = mode === "CLOSED" ? (correctCount > 1 ? "MULTIPLE" : "SINGLE") : mode;
        await saveQuestionAction(quizId, { ...q, type });
        router.refresh();
        onDone();
      } catch (e) {
        setError((e as Error).message);
      }
    });

  return (
    <div className="card space-y-5 border-brand-300 p-5 ring-2 ring-brand-100">
      <div>
        <span className="label">Type de question</span>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => changeMode(m.key)}
              className={`rounded-2xl border p-3 text-left transition ${mode === m.key ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200 hover:border-slate-300"}`}
            >
              <div className="text-sm font-medium text-slate-900">{m.label}</div>
              <div className="mt-0.5 text-xs text-slate-500">{m.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_120px]">
        <label className="block">
          <span className="label">Énoncé</span>
          <textarea className="input" rows={3} value={q.text} onChange={(e) => set({ text: e.target.value })} placeholder="Posez votre question…" />
        </label>
        <label className="block">
          <span className="label">Points</span>
          <input type="number" min="0" step="0.5" className="input" value={q.points} onChange={(e) => set({ points: Number(e.target.value) })} />
        </label>
      </div>

      {mode === "CLOSED" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="block">
              <span className="label">Nombre de choix proposés</span>
              <input type="number" min={2} max={10} className="input w-28" value={q.options.length} onChange={(e) => setChoiceCount(Number(e.target.value))} />
            </label>
            <p className="text-xs text-slate-500">
              {correctCount > 1
                ? `${correctCount} bonnes réponses : l'apprenant doit toutes les cocher (crédit partiel).`
                : "Une seule bonne réponse : l'apprenant choisit une proposition."}
            </p>
          </div>
          <span className="label">Propositions (cochez la ou les bonnes réponses)</span>
          {q.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={o.isCorrect}
                aria-label={`Proposition ${i + 1} correcte`}
                className="h-4 w-4 accent-emerald-600"
                onChange={(e) => set({ options: q.options.map((x, j) => (j === i ? { ...x, isCorrect: e.target.checked } : x)) })}
              />
              <input
                className="input"
                value={o.text}
                placeholder={`Proposition ${i + 1}`}
                onChange={(e) => set({ options: q.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
              />
              <button type="button" className="btn-ghost btn-sm" disabled={q.options.length <= 2} onClick={() => set({ options: q.options.filter((_, j) => j !== i) })} aria-label="Retirer">✕</button>
            </div>
          ))}
          {q.options.length < 10 && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => setChoiceCount(q.options.length + 1)}>Ajouter une proposition</button>
          )}
        </div>
      )}

      {mode === "TRUE_FALSE" && (
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

      {mode === "SHORT" && (
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

      {mode === "OPEN" && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Question ouverte : l&apos;apprenant rédige sa réponse, que le formateur corrige dans « Corrections ». Indiquez les éléments attendus dans la correction ci-dessous.
        </p>
      )}

      <label className="block">
        <span className="label">{mode === "OPEN" ? "Éléments de réponse attendus / correction" : "Explication / correction (affichée après la remise)"}</span>
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
