"use client";
import { useActionState } from "react";
import type { MfaState } from "@/app/actions/mfa";
import { SubmitButton } from "@/components/SubmitButton";

function Codes({ codes }: { codes: string[] }) {
  return (
    <div className="rounded-[10px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-900">Codes de secours (affichés une seule fois)</p>
      <p className="mt-1 text-sm text-slate-500">Chaque code permet une connexion si vous n&apos;avez plus votre téléphone. Imprimez-les ou rangez-les dans un gestionnaire de mots de passe.</p>
      <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">{codes.map((c) => <li key={c} className="rounded-lg bg-surface px-3 py-1.5">{c}</li>)}</ul>
    </div>
  );
}

/** Formulaire à un champ « code » (confirmation, régénération) ou mot de passe + code (désactivation). */
export function MfaCodeForm({ action, label, withPassword, danger }: { action: (s: MfaState, fd: FormData) => Promise<MfaState>; label: string; withPassword?: boolean; danger?: boolean }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      {withPassword && (
        <label className="block"><span className="label">Mot de passe</span><input name="password" type="password" required className="input" autoComplete="current-password" /></label>
      )}
      <label className="block">
        <span className="label">Code à 6 chiffres</span>
        <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input max-w-[12rem] tracking-[0.3em]" />
      </label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      {state?.codes && <Codes codes={state.codes} />}
      <SubmitButton className={danger ? "btn-danger" : "btn-primary"}>{label}</SubmitButton>
    </form>
  );
}
