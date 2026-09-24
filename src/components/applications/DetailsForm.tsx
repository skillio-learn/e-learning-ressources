"use client";
import { useActionState, useState } from "react";
import type { ActionState } from "@/app/actions/applications";
import { SubmitButton } from "@/components/SubmitButton";
import { FUNDING_TYPES, SKILL_LEVELS } from "@/lib/labels";
import { useFormFlow } from "./useFormFlow";

export function DetailsForm({
  action,
  app,
  sessions,
    prerequisites,
  disabled,
  skills = [],
  positioning,
  nextHref,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  app: {
    sessionId: string | null;
    fundingType: string | null;
    fundingReference: string | null;
    fundingDetails: string | null;
    motivation: string | null;
    expectations: string | null;
    experience: string | null;
    availability: string | null;
    prerequisitesOk: boolean;
  };
  sessions: { id: string; label: string; full: boolean }[];
    prerequisites: string | null;
  disabled?: boolean;
  skills?: string[];
  positioning?: Record<string, number> | null;
  nextHref?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const flow = useFormFlow(state?.ok, nextHref);
  const [funding, setFunding] = useState(app.fundingType ?? "");
  const refLabel: Record<string, string> = {
    CPF: "N° de dossier Mon Compte Formation *",
    FRANCE_TRAVAIL: "N° de devis / AIF (si connu)",
    OPCO: "N° de dossier de prise en charge OPCO (si connu)",
    EMPLOYER: "Référence interne employeur (si connue)",
    REGION: "Référence du dispositif régional",
  };
  return (
    <form action={formAction} onChange={flow.onChange} className="space-y-4">
      <fieldset disabled={disabled} className="space-y-4">
        {sessions.length > 0 && (
          <label className="block">
            <span className="label">Session souhaitée *</span>
            <select name="sessionId" defaultValue={app.sessionId ?? ""} className="input">
              <option value="">— Choisir une session —</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id} disabled={s.full}>
                  {s.label}
                  {s.full ? " (complète)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="label">Mode de financement *</span>
            <select name="fundingType" value={funding} onChange={(e) => setFunding(e.target.value)} className="input">
              <option value="">— Choisir —</option>
              {Object.entries(FUNDING_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {funding && funding !== "PERSONAL" && funding !== "OTHER" ? (
            <label className="block">
              <span className="label">{refLabel[funding] ?? "Référence du financement"}</span>
              <input name="fundingReference" defaultValue={app.fundingReference ?? ""} className="input" />
            </label>
          ) : (
            <input type="hidden" name="fundingReference" value={app.fundingReference ?? ""} />
          )}
        </div>
        {funding && (
          <label className="block">
            <span className="label">Précisions sur le financement</span>
            <textarea name="fundingDetails" rows={2} defaultValue={app.fundingDetails ?? ""} className="input" placeholder="Conseiller France Travail, montant pris en charge, reste à charge…" />
          </label>
        )}
        <label className="block">
          <span className="label">Votre motivation et votre projet professionnel *</span>
          <textarea name="motivation" rows={5} defaultValue={app.motivation ?? ""} className="input" placeholder="Pourquoi cette formation ? Quel est votre projet ?" />
        </label>
        <label className="block">
          <span className="label">Vos attentes vis-à-vis de la formation</span>
          <textarea name="expectations" rows={3} defaultValue={app.expectations ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">Expérience et connaissances dans le domaine (positionnement)</span>
          <textarea name="experience" rows={3} defaultValue={app.experience ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">Disponibilités (jours, créneaux, heures par semaine)</span>
          <input name="availability" defaultValue={app.availability ?? ""} className="input" />
        </label>
                {skills.length > 0 && (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-1 text-sm font-medium">Positionnement : évaluez votre niveau actuel sur chaque compétence visée *</div>
            <p className="mb-2 text-xs text-slate-500">Cette auto-évaluation permet à l&apos;organisme d&apos;adapter votre parcours ; elle sera comparée à votre niveau en fin de formation.</p>
            <div className="space-y-2">
              {skills.map((skill, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 pb-2 text-sm">
                  <span>{skill}</span>
                  <select name={`skill_${i}`} defaultValue={positioning?.[skill] ?? ""} className="input w-auto py-1 text-sm">
                    <option value="">—</option>
                    {SKILL_LEVELS.map((l, v) => <option key={v} value={v}>{v} – {l}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
        {prerequisites && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="font-medium">Prérequis de la formation :</div>
            <div className="mt-1 whitespace-pre-wrap text-slate-600">{prerequisites}</div>
          </div>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="prerequisitesOk" defaultChecked={app.prerequisitesOk} className="mt-1 accent-brand-600" />
          J&apos;atteste remplir les prérequis de la formation (ou en avoir discuté avec l&apos;organisme). *
        </label>
      </fieldset>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.ok}</p>}
      {!disabled && <SubmitButton>{nextHref ? "Enregistrer et continuer →" : "Enregistrer mon projet"}</SubmitButton>}
    </form>
  );
}
