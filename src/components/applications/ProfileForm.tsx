"use client";
import { useActionState, useState } from "react";
import type { ActionState } from "@/app/actions/applications";
import { useFormFlow } from "./useFormFlow";
import { SubmitButton } from "@/components/SubmitButton";
import { EDUCATION_LEVELS, EMPLOYMENT_STATUS } from "@/lib/labels";

export type ProfileData = {
  civility?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  birthName?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  nationality?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  employmentStatus?: string | null;
  franceTravailId?: string | null;
  franceTravailAgency?: string | null;
  educationLevel?: string | null;
  lastDiploma?: string | null;
  currentJob?: string | null;
  employerName?: string | null;
  employerSiret?: string | null;
  employerAddress?: string | null;
  employerContactName?: string | null;
  employerContactEmail?: string | null;
  employerContactPhone?: string | null;
  opcoName?: string | null;
  disability?: boolean | null;
  disabilityNeeds?: string | null;
};

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function ProfileForm({
  action,
    profile,
  disabled,
  nextHref,
  submitLabel = "Enregistrer mes informations",
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  profile: ProfileData | null;
  disabled?: boolean;
  nextHref?: string;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const flow = useFormFlow(state?.ok, nextHref);
  const [status, setStatus] = useState(profile?.employmentStatus ?? "");
  const [disability, setDisability] = useState(!!profile?.disability);
  const p = profile ?? {};
  const showEmployer = status === "EMPLOYEE" || status === "CIVIL_SERVANT" || status === "SELF_EMPLOYED";
  return (
    <form action={formAction} onChange={flow.onChange} className="space-y-5">
      <fieldset disabled={disabled} className="space-y-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Identité</h3>
          <div className="grid gap-3 md:grid-cols-4">
            <F label="Civilité *">
              <select name="civility" defaultValue={p.civility ?? ""} className="input">
                <option value="">—</option>
                <option>Mme</option>
                <option>M.</option>
              </select>
            </F>
            <F label="Prénom *"><input name="firstName" defaultValue={p.firstName ?? ""} className="input" autoComplete="given-name" /></F>
            <F label="Nom *"><input name="lastName" defaultValue={p.lastName ?? ""} className="input" autoComplete="family-name" /></F>
            <F label="Nom de naissance"><input name="birthName" defaultValue={p.birthName ?? ""} className="input" /></F>
            <F label="Date de naissance *"><input name="birthDate" type="date" defaultValue={p.birthDate ?? ""} className="input" autoComplete="bday" /></F>
            <F label="Lieu de naissance *"><input name="birthPlace" defaultValue={p.birthPlace ?? ""} className="input" placeholder="Ville (département)" /></F>
            <F label="Nationalité *"><input name="nationality" defaultValue={p.nationality ?? ""} className="input" placeholder="Française" /></F>
            <F label="Téléphone *"><input name="phone" type="tel" defaultValue={p.phone ?? ""} className="input" autoComplete="tel" /></F>
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Adresse</h3>
          <div className="grid gap-3 md:grid-cols-4">
            <F label="Adresse *" className="md:col-span-2"><input name="address" defaultValue={p.address ?? ""} className="input" autoComplete="street-address" /></F>
            <F label="Code postal *"><input name="postalCode" defaultValue={p.postalCode ?? ""} className="input" autoComplete="postal-code" /></F>
            <F label="Ville *"><input name="city" defaultValue={p.city ?? ""} className="input" autoComplete="address-level2" /></F>
            <F label="Pays"><input name="country" defaultValue={p.country ?? "France"} className="input" /></F>
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Situation & parcours</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <F label="Situation professionnelle *">
              <select name="employmentStatus" value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                <option value="">—</option>
                {Object.entries(EMPLOYMENT_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </F>
            <F label="Niveau de formation *">
              <select name="educationLevel" defaultValue={p.educationLevel ?? ""} className="input">
                <option value="">—</option>
                {EDUCATION_LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </F>
            <F label="Dernier diplôme obtenu"><input name="lastDiploma" defaultValue={p.lastDiploma ?? ""} className="input" /></F>
            <F label="Emploi actuel / dernier emploi"><input name="currentJob" defaultValue={p.currentJob ?? ""} className="input" /></F>
            {status === "JOB_SEEKER" && (
              <>
                <F label="Identifiant France Travail *"><input name="franceTravailId" defaultValue={p.franceTravailId ?? ""} className="input" /></F>
                <F label="Agence France Travail"><input name="franceTravailAgency" defaultValue={p.franceTravailAgency ?? ""} className="input" /></F>
              </>
            )}
          </div>
        </div>
        {showEmployer && (
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Employeur (obligatoire pour un financement OPCO / employeur)</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <F label="Raison sociale"><input name="employerName" defaultValue={p.employerName ?? ""} className="input" /></F>
              <F label="SIRET (14 chiffres)"><input name="employerSiret" defaultValue={p.employerSiret ?? ""} className="input" inputMode="numeric" /></F>
              <F label="OPCO de l'entreprise"><input name="opcoName" defaultValue={p.opcoName ?? ""} className="input" placeholder="Atlas, Akto, OPCO EP…" /></F>
              <F label="Adresse de l'employeur" className="md:col-span-3"><input name="employerAddress" defaultValue={p.employerAddress ?? ""} className="input" /></F>
              <F label="Contact RH / référent"><input name="employerContactName" defaultValue={p.employerContactName ?? ""} className="input" /></F>
              <F label="Email du contact"><input name="employerContactEmail" type="email" defaultValue={p.employerContactEmail ?? ""} className="input" /></F>
              <F label="Téléphone du contact"><input name="employerContactPhone" defaultValue={p.employerContactPhone ?? ""} className="input" /></F>
            </div>
          </div>
        )}
        {!showEmployer && (
          <>
            {/* Conserve les données employeur éventuellement saisies */}
            {["employerName", "employerSiret", "opcoName", "employerAddress", "employerContactName", "employerContactEmail", "employerContactPhone"].map((k) => (
              <input key={k} type="hidden" name={k} value={(p as Record<string, string | null | undefined>)[k] ?? ""} />
            ))}
          </>
        )}
        {status !== "JOB_SEEKER" && (
          <>
            <input type="hidden" name="franceTravailId" value={p.franceTravailId ?? ""} />
            <input type="hidden" name="franceTravailAgency" value={p.franceTravailAgency ?? ""} />
          </>
        )}
        <div className="rounded-lg bg-slate-50 p-4">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="disability" checked={disability} onChange={(e) => setDisability(e.target.checked)} className="mt-1 accent-brand-600" />
            <span>
              <b>Situation de handicap / RQTH</b> — je souhaite que le référent handicap de l&apos;organisme étudie des aménagements
              (information confidentielle).
            </span>
          </label>
          {disability && (
            <textarea name="disabilityNeeds" defaultValue={p.disabilityNeeds ?? ""} rows={3} className="input mt-2" placeholder="Aménagements souhaités (temps, supports, accessibilité…)" />
          )}
        </div>
      </fieldset>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.ok}</p>}
      {!disabled && <SubmitButton>{submitLabel}</SubmitButton>}
    </form>
  );
}
