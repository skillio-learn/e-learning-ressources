"use client";
import { useActionState } from "react";
import { SubmitButton } from "./SubmitButton";

type S = { error?: string; ok?: string } | undefined;

/** Formulaire générique affichant le message de retour d'une server action. */
export function StateForm({
  action,
  children,
  submitLabel = "Enregistrer",
  className,
  submitClassName,
}: {
  action: (s: S, fd: FormData) => Promise<S>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  submitClassName?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className ?? "space-y-4"}>
      {children}
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 break-all">{state.ok}</p>}
      <SubmitButton className={submitClassName}>{submitLabel}</SubmitButton>
    </form>
  );
}
