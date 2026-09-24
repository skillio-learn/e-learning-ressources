"use client";
import { useActionState, useRef } from "react";
import { SubmitButton } from "@/components/SubmitButton";

type S = { error?: string; ok?: string } | undefined;

export function Composer({ action, placeholder }: { action: (s: S, fd: FormData) => Promise<S>; placeholder: string }) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await formAction(fd);
        ref.current?.reset();
      }}
      className="space-y-2"
    >
      <textarea name="body" rows={3} required className="input" placeholder={placeholder} />
      <div className="flex items-center justify-between">
        {state?.error ? <span className="text-sm text-red-600">{state.error}</span> : <span />}
        <SubmitButton className="btn-primary btn-sm" pendingLabel="Envoi…">Envoyer</SubmitButton>
      </div>
    </form>
  );
}
