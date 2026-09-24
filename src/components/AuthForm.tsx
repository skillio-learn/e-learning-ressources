"use client";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

export function AuthForm({
  action,
  mode,
  next,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  mode: "login" | "register";
  next?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "register" && (
        <label className="block">
          <span className="label">Nom complet</span>
          <input name="name" required className="input" autoComplete="name" />
        </label>
      )}
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required className="input" autoComplete="email" />
      </label>
      <label className="block">
        <span className="label">Mot de passe</span>
        <input
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 8 : undefined}
          className="input"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <SubmitButton className="btn-primary w-full" pendingLabel="Veuillez patienter…">
        {mode === "login" ? "Se connecter" : "Créer mon compte"}
      </SubmitButton>
    </form>
  );
}
