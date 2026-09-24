"use client";
import { useActionState } from "react";
import type { ActionState } from "@/app/actions/learner-extra";
import { SubmitButton } from "@/components/SubmitButton";
import { SATISFACTION_QUESTIONS } from "@/lib/labels";

export function SatisfactionForm({ action }: { action: (s: ActionState, fd: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, undefined);
  if (state?.ok) return <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{state.ok}</p>;
  return (
    <form action={formAction} className="space-y-4">
      <p className="text-xs text-slate-500">1 = pas du tout satisfait · 5 = très satisfait</p>
      {SATISFACTION_QUESTIONS.map((q) => (
        <fieldset key={q.code} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <legend className="sr-only">{q.label}</legend>
          <span className="text-sm">{q.label}</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer">
                <input type="radio" name={q.code} value={n} className="peer sr-only" required />
                <span className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 text-sm peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white">
                  {n}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        Recommanderiez-vous cette formation ?
        <label className="flex items-center gap-1"><input type="radio" name="recommend" value="yes" /> Oui</label>
        <label className="flex items-center gap-1"><input type="radio" name="recommend" value="no" /> Non</label>
      </div>
      <textarea name="comment" rows={3} className="input" placeholder="Vos commentaires et suggestions (facultatif)" />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton>Envoyer mon avis</SubmitButton>
    </form>
  );
}
