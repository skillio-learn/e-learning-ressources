import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { deleteSubcontractorAction, saveSubcontractorAction } from "@/app/actions/quality";
import { StateForm } from "@/components/StateForm";
import { Badge, Empty, Field, PageHeader } from "@/components/ui";
import { ACCEPT_ATTR } from "@/lib/uploads";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Sous-traitants" };
export const dynamic = "force-dynamic";

const KINDS: Record<string, string> = { SUBCONTRACTOR: "Organisme sous-traitant", FREELANCE_TRAINER: "Formateur indépendant", PORTAGE: "Portage salarial" };
const toInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
type Sub = { id: string; name: string; siret: string | null; kind: string; contactEmail: string | null; qualiopiCertified: boolean; qualiopiExpiresAt: Date | null; contractSignedAt: Date | null; lastEvaluationAt: Date | null; evaluationNote: string | null; contractFileName: string | null };

function Fields({ s }: { s?: Sub }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nom"><input name="name" required defaultValue={s?.name} className="input" /></Field>
      <Field label="Type"><select name="kind" defaultValue={s?.kind ?? "SUBCONTRACTOR"} className="input">{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="SIRET"><input name="siret" defaultValue={s?.siret ?? ""} className="input" /></Field>
      <Field label="E-mail"><input name="contactEmail" type="email" defaultValue={s?.contactEmail ?? ""} className="input" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="qualiopiCertified" defaultChecked={s?.qualiopiCertified} className="h-4 w-4" /> Certifié Qualiopi</label>
      <Field label="Fin de validité de sa certification"><input type="date" name="qualiopiExpiresAt" defaultValue={toInput(s?.qualiopiExpiresAt ?? null)} className="input" /></Field>
      <Field label="Contrat signé le (avec clause de conformité au référentiel)"><input type="date" name="contractSignedAt" defaultValue={toInput(s?.contractSignedAt ?? null)} className="input" /></Field>
      <Field label={`Contrat (PDF, 4 Mo max.)${s?.contractFileName ? ` · actuel : ${s.contractFileName}` : ""}`}><input type="file" name="contract" accept={ACCEPT_ATTR.document} className="text-sm" /></Field>
      <Field label="Dernière évaluation le"><input type="date" name="lastEvaluationAt" defaultValue={toInput(s?.lastEvaluationAt ?? null)} className="input" /></Field>
      <Field label="Bilan de l'évaluation"><textarea name="evaluationNote" rows={2} defaultValue={s?.evaluationNote ?? ""} className="input" /></Field>
    </div>
  );
}

export default async function Subcontractors() {
  const user = await requireStaff();
  const subs = await db.subcontractor.findMany({ where: { organizationId: user.organizationId! }, orderBy: { name: "asc" }, omit: { contractData: true } });
  return (
    <>
      <PageHeader title="Sous-traitants et portage" subtitle="Indicateur 27 : depuis le référentiel 2026, un contrat formalisé doit tracer la vérification de conformité du prestataire et la répartition des responsabilités. Évaluez chaque prestataire au moins une fois par an." />
      <details className="card p-6" open={!subs.length}>
        <summary className="cursor-pointer text-xl text-brand-600">Ajouter un prestataire</summary>
        <StateForm action={saveSubcontractorAction.bind(null, null)} submitLabel="Enregistrer" submitClassName="btn-primary" className="mt-4 space-y-3"><Fields /></StateForm>
      </details>
      <div className="mt-6 space-y-3">
        {subs.length === 0 && <Empty title="Aucun prestataire déclaré">Si vous ne sous-traitez pas, marquez l&apos;indicateur 27 comme non applicable.</Empty>}
        {subs.map((s) => (
          <details key={s.id} className="card p-5">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1"><span className="block font-medium text-slate-900">{s.name}</span><span className="text-sm text-slate-500">{KINDS[s.kind]}</span></span>
              <Badge tone={s.contractSignedAt ? "green" : "red"}>{s.contractSignedAt ? `Contrat du ${formatDate(s.contractSignedAt)}` : "Contrat manquant"}</Badge>
              <Badge tone={s.qualiopiCertified ? "green" : "gray"}>{s.qualiopiCertified ? `Qualiopi${s.qualiopiExpiresAt ? ` jusqu'au ${formatDate(s.qualiopiExpiresAt)}` : ""}` : "Non certifié"}</Badge>
              <Badge tone={s.lastEvaluationAt ? "green" : "red"}>{s.lastEvaluationAt ? `Évalué le ${formatDate(s.lastEvaluationAt)}` : "Jamais évalué"}</Badge>
            </summary>
            {s.contractFileName && <a href={`/api/quality/subcontractors/${s.id}`} className="link mt-3 inline-block text-sm">Télécharger le contrat</a>}
            <StateForm action={saveSubcontractorAction.bind(null, s.id)} submitLabel="Mettre à jour" submitClassName="btn-secondary" className="mt-4 space-y-3"><Fields s={s} /></StateForm>
            <form action={deleteSubcontractorAction.bind(null, s.id)} className="mt-2"><button className="btn-ghost btn-sm text-red-600">Supprimer</button></form>
          </details>
        ))}
      </div>
    </>
  );
}
