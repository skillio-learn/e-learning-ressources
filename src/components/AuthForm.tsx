"use client";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

/** Formulaire de connexion. Les comptes apprenants sont créés par les organismes de formation. */
export function AuthForm({ action, next }: { action: (s: FormState, fd: FormData) => Promise<FormState>; next?: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required className="input" autoComplete="email" />
      </label>
      <label className="block">
        <span className="label">Mot de passe</span>
        <input name="password" type="password" required className="input" autoComplete="current-password" />
      </label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <SubmitButton className="btn-primary w-full" pendingLabel="Veuillez patienter…">
        Se connecter
      </SubmitButton>
    </form>
  );
}
