import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { SCOPE_LABELS } from "@/lib/qualiopi";
import { saveQualiopiSettingsAction } from "@/app/actions/quality";
import { StateForm } from "@/components/StateForm";
import { Field, PageHeader } from "@/components/ui";

export const metadata = { title: "Paramètres Qualiopi" };
export const dynamic = "force-dynamic";

const toFr = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

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
        <div className="rounded-[10px] border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-medium text-slate-900">Certification Qualiopi</div>
            <Link href={`/of/tickets?category=ORG_INFO&subject=${encodeURIComponent("Mise à jour de la certification Qualiopi")}`} className="btn-secondary btn-sm">Demander une mise à jour</Link>
          </div>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Statut</dt><dd>{org.qualiopiCertified ? "Certifié" : "Non certifié"}</dd></div>
            <div><dt className="text-slate-500">Numéro de certificat</dt><dd>{org.qualiopiNumber ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Organisme certificateur</dt><dd>{org.qualiopiCertifier ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Validité</dt><dd>{org.qualiopiDate ? `du ${toFr(org.qualiopiDate)}` : "—"}{org.qualiopiExpiresAt ? ` au ${toFr(org.qualiopiExpiresAt)}` : ""}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">Ces informations figurent sur vos documents et votre page publique : elles sont vérifiées et saisies par le support Vylia à partir de votre certificat. Joignez-le à votre demande.</p>
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
