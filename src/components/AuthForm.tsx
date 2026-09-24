"use client";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

export function AuthForm({
  action,
  mode,
  next,
  of,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  mode: "login" | "register";
  next?: string;
  of?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {of && <input type="hidden" name="of" value={of} />}
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
      {mode === "register" && (
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" name="consent" required className="mt-1 accent-brand-600" />
          <span>
            J&apos;accepte les <a href="/legal/cgu" target="_blank" className="text-brand-600 underline">conditions générales d&apos;utilisation</a> et
            la <a href="/legal/confidentialite" target="_blank" className="text-brand-600 underline">politique de confidentialité</a>{" "}
            (traitement de mes données pour la gestion de ma formation).
          </span>
        </label>
      )}
      {mode === "register" && <p className="text-xs text-slate-500">8 caractères minimum, avec au moins une lettre et un chiffre.</p>}
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <SubmitButton className="btn-primary w-full" pendingLabel="Veuillez patienter…">
        {mode === "login" ? "Se connecter" : "Créer mon compte"}
      </SubmitButton>
    </form>
  );
}
