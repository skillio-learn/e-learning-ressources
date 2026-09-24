"use client";
import { useActionState } from "react";
import type { EnrollResult } from "@/app/actions/trainer";
import { SubmitButton } from "@/components/SubmitButton";

export function EnrollForm({ action }: { action: (prev: EnrollResult, fd: FormData) => Promise<EnrollResult> }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="card space-y-3 p-4">
      <h2 className="text-base">Inscrire des apprenants</h2>
      <textarea
        name="emails"
        rows={6}
        className="input font-mono text-xs"
        placeholder={"Un apprenant par ligne :\nmarie@exemple.fr Marie Dupont\nJean Martin <jean@exemple.fr>\npaul@exemple.fr"}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="createMissing" defaultChecked className="accent-brand-600" />
        Créer les comptes manquants
      </label>
      <SubmitButton className="btn-primary w-full" pendingLabel="Inscription…">Inscrire</SubmitButton>
      {state && (
        <div className="space-y-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          <div>✅ {state.enrolled} apprenant(s) inscrit(s).</div>
          {state.notFound.length > 0 && <div className="text-amber-800">Comptes introuvables : {state.notFound.join(", ")}</div>}
          {state.created.length > 0 && (
            <div>
              <div className="font-medium">Comptes créés — transmettez ces identifiants :</div>
              <table className="mt-1 w-full text-xs">
                <tbody>
                  {state.created.map((c) => (
                    <tr key={c.email}>
                      <td className="pr-2">{c.email}</td>
                      <td className="font-mono">{c.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-xs text-emerald-700">Ces mots de passe ne seront plus affichés. L&apos;apprenant pourra le modifier dans son profil.</p>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
