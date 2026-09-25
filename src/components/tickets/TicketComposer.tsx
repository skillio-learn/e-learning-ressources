"use client";
import { useActionState, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";
import { cn } from "@/lib/utils";

type S = { error?: string; ok?: string } | undefined;

/** Réponse sur un ticket, avec pièce jointe et (côté support) note interne. */
export function TicketComposer({
  action,
  placeholder,
  allowInternal = false,
}: {
  action: (s: S, fd: FormData) => Promise<S>;
  placeholder: string;
  allowInternal?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [internal, setInternal] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await formAction(fd);
        ref.current?.reset();
        setFileName(null);
        setInternal(false);
      }}
      className="space-y-2"
    >
      <textarea
        name="body"
        rows={4}
        required
        className={cn("input", internal && "border-amber-300 bg-amber-50/60 focus:border-amber-400")}
        placeholder={internal ? "Note interne : visible uniquement par le support Vylia…" : placeholder}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-ghost btn-sm cursor-pointer">
          <Paperclip className="h-4 w-4" strokeWidth={1.75} />
          <span className="max-w-[180px] truncate">{fileName ?? "Joindre un fichier"}</span>
          <input
            type="file"
            name="file"
            className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.odt"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        {allowInternal && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="internal" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
            Note interne
          </label>
        )}
        <span className="flex-1 text-right text-sm">
          {state?.error ? <span className="text-red-600">{state.error}</span> : state?.ok ? <span className="text-emerald-600">{state.ok}</span> : null}
        </span>
        <SubmitButton className={internal ? "btn-secondary btn-sm" : "btn-primary btn-sm"} pendingLabel="Envoi…">
          {internal ? "Ajouter la note" : "Envoyer"}
        </SubmitButton>
      </div>
    </form>
  );
}
