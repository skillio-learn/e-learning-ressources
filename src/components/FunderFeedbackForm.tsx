"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { FUNDER_QUESTIONS } from "@/lib/labels";

type S = { error?: string; ok?: string } | undefined;

export function FunderFeedbackForm({ action, defaultName }: { action: (s: S, fd: FormData) => Promise<S>; defaultName: string }) {
  const [state, formAction] = useActionState(action, undefined);
  if (state?.ok) return <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{state.ok}</p>;
  return (
    <form action={formAction} className="space-y-4">
      <input name="respondentName" defaultValue={defaultName} placeholder="Votre nom et structure" className="input" />
      <p className="text-xs text-slate-500">1 = pas du tout satisfait · 5 = très satisfait</p>
      {FUNDER_QUESTIONS.map((q) => (
        <fieldset key={q.code} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <legend className="sr-only">{q.label}</legend>
          <span className="text-sm">{q.label}</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer">
                <input type="radio" name={q.code} value={n} className="peer sr-only" required />
                <span className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 text-sm peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white">{n}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <textarea name="comment" rows={3} className="input" placeholder="Commentaires, axes d'amélioration (facultatif)" />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton>Envoyer mon évaluation</SubmitButton>
    </form>
  );
}
