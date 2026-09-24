"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { SKILL_LEVELS } from "@/lib/labels";

type S = { error?: string; ok?: string } | undefined;

export function ExitAssessmentForm({ action, skills, entry }: { action: (s: S, fd: FormData) => Promise<S>; skills: string[]; entry: Record<string, number> }) {
  const [state, formAction] = useActionState(action, undefined);
  if (state?.ok) return <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{state.ok}</p>;
  return (
    <form action={formAction} className="space-y-2">
      {skills.map((s, i) => (
        <div key={s} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-sm">
          <span>
            {s}
            {entry[s] !== undefined && <span className="ml-2 text-xs text-slate-400">(à l&apos;entrée : {SKILL_LEVELS[entry[s]]})</span>}
          </span>
          <select name={`skill_${i}`} required defaultValue="" className="input w-auto py-1 text-sm">
            <option value="">— Mon niveau aujourd&apos;hui —</option>
            {SKILL_LEVELS.map((l, v) => <option key={v} value={v}>{v} – {l}</option>)}
          </select>
        </div>
      ))}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton>Enregistrer mon auto-évaluation</SubmitButton>
    </form>
  );
}
