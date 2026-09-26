"use client";
import { useState } from "react";
import { SignaturePad } from "@/components/SignaturePad";
import { signCompanyConventionAction } from "@/app/actions/companies";

/** Signature en ligne de la convention par le contact de l'entreprise. */
export function ConventionSign({ id, signerName }: { id: string; signerName: string }) {
  const [title, setTitle] = useState("");
  const [accept, setAccept] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  if (done) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{done}</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Vous signez en tant que <b>{signerName}</b>, pour le compte de l&apos;entreprise.</p>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Votre fonction</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1" placeholder="Ex. : Responsable RH" maxLength={120} />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 h-4 w-4" />
        J&apos;ai lu la convention et j&apos;accepte ses conditions ; je suis habilité(e) à engager l&apos;entreprise.
      </label>
      <SignaturePad
        label="Signer la convention"
        onSign={async (dataUrl) => {
          const fd = new FormData();
          fd.set("signature", dataUrl);
          fd.set("signerTitle", title);
          if (accept) fd.set("accept", "on");
          const r = await signCompanyConventionAction(id, undefined, fd);
          if (r?.error) throw new Error(r.error);
          setDone(r?.ok ?? "Convention signée.");
        }}
      />
    </div>
  );
}
