"use client";
import { useActionState, useState } from "react";
import type { AssignmentState } from "@/app/actions/learner";
import { SubmitButton } from "@/components/SubmitButton";

const MAX_MB = 4;

/** Remise d'un devoir : texte, lien et/ou fichier (contrôle de taille dans le navigateur). */
export function AssignmentForm({
  action,
  submission,
}: {
  action: (s: AssignmentState, fd: FormData) => Promise<AssignmentState>;
  submission: { text: string | null; linkUrl: string | null } | null;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [tooBig, setTooBig] = useState(false);
  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="label">Réponse écrite</span>
        <textarea name="text" rows={8} className="input" defaultValue={submission?.text ?? ""} placeholder="Rédigez votre réponse…" />
      </label>
      <label className="block">
        <span className="label">Fichier</span>
        <input
          name="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.odt,.xlsx,.pptx,.zip,.mp3,.mp4"
          className="input"
          onChange={(e) => setTooBig((e.target.files?.[0]?.size ?? 0) > MAX_MB * 1024 * 1024)}
        />
        <span className="hint block">
          PDF, photo de votre exercice papier, document Word / Excel / PowerPoint, courte vidéo MP4 ({MAX_MB} Mo maximum).
        </span>
        {tooBig && <span className="mt-1 block text-sm text-red-600">Fichier trop volumineux : déposez plutôt votre vidéo en ligne et collez le lien ci-dessous.</span>}
      </label>
      <label className="block">
        <span className="label">Lien (vidéo, document en ligne, portfolio…)</span>
        <input name="linkUrl" type="url" className="input" defaultValue={submission?.linkUrl ?? ""} placeholder="https://…" />
        <span className="hint block">Pour une vidéo plus lourde : YouTube (non répertoriée), Google Drive, WeTransfer…</span>
      </label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.ok}</p>}
      <SubmitButton pendingLabel="Envoi…" disabled={tooBig}>{submission ? "Mettre à jour mon rendu" : "Remettre le devoir"}</SubmitButton>
    </form>
  );
}
