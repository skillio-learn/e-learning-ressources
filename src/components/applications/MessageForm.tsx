"use client";
import { useActionState, useRef } from "react";
import type { ActionState } from "@/app/actions/applications";
import { SubmitButton } from "@/components/SubmitButton";

export function MessageForm({ action, staff }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; staff?: boolean }) {
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
      <textarea name="message" rows={3} required className="input" placeholder={staff ? "Message à l'apprenant ou note interne…" : "Votre message à l'organisme de formation…"} />
      <div className="flex flex-wrap items-center gap-3">
        {staff && (
          <label className="flex items-center gap-2 text-sm text-amber-800">
            <input type="checkbox" name="internal" className="accent-amber-600" /> Note interne (invisible pour l&apos;apprenant)
          </label>
        )}
        <SubmitButton className="btn-primary btn-sm ml-auto" pendingLabel="Envoi…">Envoyer</SubmitButton>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
