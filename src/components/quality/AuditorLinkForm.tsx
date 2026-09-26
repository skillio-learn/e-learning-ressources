"use client";
import { useActionState } from "react";
import type { QState } from "@/app/actions/quality";
import { SubmitButton } from "@/components/SubmitButton";

export function AuditorLinkForm({ action }: { action: (s: QState, fd: FormData) => Promise<QState> }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block"><span className="label">Nom de l&apos;auditeur</span><input name="label" className="input" placeholder="Ex. Mme Dupont, certificateur X" /></label>
        <label className="block"><span className="label">Durée (jours)</span><input name="days" type="number" min={1} max={30} defaultValue={7} className="input w-28" /></label>
        <SubmitButton className="btn-primary">Créer le lien</SubmitButton>
      </div>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      {state?.link && (
        <div className="rounded-[10px] bg-emerald-50 p-3 text-sm text-emerald-700">
          <p>{state.ok}</p>
          <p className="mt-1 break-all font-mono text-slate-900">{state.link}</p>
        </div>
      )}
    </form>
  );
}
