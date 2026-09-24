"use client";
import { useActionState, useRef } from "react";
import type { ActionState } from "@/app/actions/applications";
import { SubmitButton } from "@/components/SubmitButton";

export function DocumentUpload({
  action,
  type,
  label,
  optionalTypes,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  type?: string;
  label?: string;
  optionalTypes?: { code: string; label: string }[];
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await formAction(fd);
        ref.current?.reset();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      {type ? (
        <input type="hidden" name="type" value={type} />
      ) : (
        <select name="type" className="input w-auto" required>
          {optionalTypes?.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
        </select>
      )}
      <input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.odt" className="max-w-full text-sm" />
      <SubmitButton className="btn-secondary btn-sm" pendingLabel="Envoi…">{label ?? "Déposer"}</SubmitButton>
      {state?.error && <span className="w-full text-xs text-red-600">{state.error}</span>}
      {state?.ok && <span className="w-full text-xs text-emerald-700">{state.ok}</span>}
    </form>
  );
}
