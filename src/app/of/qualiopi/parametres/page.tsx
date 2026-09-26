import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { SCOPE_LABELS } from "@/lib/qualiopi";
import { saveQualiopiSettingsAction } from "@/app/actions/quality";
import { StateForm } from "@/components/StateForm";
import { Field, PageHeader } from "@/components/ui";

export const metadata = { title: "Paramètres Qualiopi" };
export const dynamic = "force-dynamic";

const toInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function QualiopiSettings() {
  const user = await requireStaff();
  const orgId = user.organizationId!;
  const [org, team] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId } }),
    db.user.findMany({ where: { organizationId: orgId, role: { in: ["OF_ADMIN", "TRAINER"] }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Paramètres Qualiopi" subtitle="Certification, catégories d'actions, version du référentiel et référents. Ces réglages déterminent les indicateurs applicables." />
      <StateForm action={saveQualiopiSettingsAction} submitLabel="Enregistrer" submitClassName="btn-primary" className="card space-y-5 p-6">
        <label className="flex items-center gap-2"><input type="checkbox" name="qualiopiCertified" defaultChecked={org.qualiopiCertified} className="h-4 w-4" /> Notre organisme est certifié Qualiopi</label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Numéro de certificat"><input name="qualiopiNumber" defaultValue={org.qualiopiNumber ?? ""} className="input" /></Field>
          <Field label="Organisme certificateur"><input name="qualiopiCertifier" defaultValue={org.qualiopiCertifier ?? ""} className="input" /></Field>
          <Field label="Date de certification"><input type="date" name="qualiopiDate" defaultValue={toInput(org.qualiopiDate)} className="input" /></Field>
          <Field label="Fin de validité"><input type="date" name="qualiopiExpiresAt" defaultValue={toInput(org.qualiopiExpiresAt)} className="input" /></Field>
        </div>
        <fieldset>
          <legend className="label">Catégories d&apos;actions certifiées</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {Object.entries(SCOPE_LABELS).map(([k, v]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" name="scope" value={k} defaultChecked={org.qualiopiScope.includes(k)} className="h-4 w-4" /> {v}</label>)}
          </div>
        </fieldset>
        <Field label="Référentiel applicable">
          <select name="rnqVersion" defaultValue={org.rnqVersion} className="input">
            <option value="2026">Référentiel 2026 : 33 indicateurs, audits à partir du 1er novembre 2026</option>
            <option value="2019">Référentiel 2019 : 32 indicateurs (audits réalisés avant le 1er novembre 2026)</option>
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Référent qualité (accès au module Qualiopi)">
            <select name="qualityReferentId" defaultValue={org.qualityReferentId ?? ""} className="input"><option value="">Le responsable de l&apos;organisme</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </Field>
          <Field label="Référent handicap (reçoit les demandes d'aménagement)">
            <select name="handicapReferentId" defaultValue={org.handicapReferentId ?? ""} className="input"><option value="">—</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </Field>
        </div>
        <p className="rounded-[10px] bg-brand-50 p-4 text-sm text-brand-700">
          Le référentiel 2026 (décret n° 2026-728 du 1er août 2026) s&apos;applique à tout audit réalisé à partir du 1er novembre 2026, y compris les audits de surveillance, sans période transitoire. Le guide de lecture V10 et les arrêtés fixant les seuils des indicateurs 19 et 20 étaient attendus lors de la mise en place de ce module : Vylia intégrera leurs précisions dès leur publication.
        </p>
      </StateForm>
    </>
  );
}
