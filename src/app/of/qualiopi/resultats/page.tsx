import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { computeResults } from "@/lib/results";
import { saveCertificationRateAction, saveResultsPublicationAction } from "@/app/actions/quality";
import { ResultsView } from "@/components/quality/ResultsView";
import { StateForm } from "@/components/StateForm";
import { Field, PageHeader } from "@/components/ui";

export const metadata = { title: "Indicateurs de résultats" };
export const dynamic = "force-dynamic";

export default async function Results() {
  const user = await requireStaff();
  const orgId = user.organizationId!;
  const [org, r, certifying] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { slug: true, publishResults: true, resultsNote: true } }),
    computeResults(orgId),
    db.course.findMany({ where: { organizationId: orgId, rncpCode: { not: null } }, select: { id: true, title: true, rncpCode: true, certSuccessRate: true, certCandidates: true, certPeriod: true }, orderBy: { title: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Indicateurs de résultats" subtitle="Indicateurs 2 et 3 : calculés automatiquement à partir des parcours, avis et enquêtes, publiés sur une page publique avec leur période, leur effectif et leur méthode de calcul." />
      <section className="card mb-6 p-6">
        <StateForm action={saveResultsPublicationAction} submitLabel="Enregistrer" submitClassName="btn-primary" className="space-y-3">
          <label className="flex items-center gap-2"><input type="checkbox" name="publishResults" defaultChecked={org.publishResults} className="h-4 w-4" /> Publier la page des résultats</label>
          <Field label="Commentaire publié (contexte, nombre de sessions, précisions)"><textarea name="resultsNote" rows={2} defaultValue={org.resultsNote ?? ""} className="input" /></Field>
        </StateForm>
        {org.publishResults && (
          <p className="mt-3 text-sm">Adresse publique à reprendre sur votre site et vos fiches EDOF : <Link href={`/o/${org.slug}/resultats`} className="link" target="_blank">/o/{org.slug}/resultats</Link></p>
        )}
      </section>
      {certifying.length > 0 && (
        <section className="card mb-6 p-6">
          <h2 className="text-xl">Taux d&apos;obtention des certifications (indicateur 3)</h2>
          <p className="mt-1 text-sm text-slate-500">Saisissez les résultats transmis par le certificateur.</p>
          <div className="mt-4 space-y-4">
            {certifying.map((c) => (
              <StateForm key={c.id} action={saveCertificationRateAction.bind(null, c.id)} submitLabel="Enregistrer" submitClassName="btn-secondary btn-sm" className="grid items-end gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
                <div className="text-sm"><div className="font-medium text-slate-900">{c.title}</div><div className="text-slate-500">{c.rncpCode}</div></div>
                <Field label="Taux (%)"><input name="certSuccessRate" inputMode="decimal" defaultValue={c.certSuccessRate ?? ""} className="input" /></Field>
                <Field label="Présentés"><input name="certCandidates" inputMode="numeric" defaultValue={c.certCandidates ?? ""} className="input" /></Field>
                <Field label="Période"><input name="certPeriod" defaultValue={c.certPeriod ?? ""} placeholder="Sessions 2025" className="input" /></Field>
              </StateForm>
            ))}
          </div>
        </section>
      )}
      <h2 className="mb-3 text-xl">Aperçu</h2>
      <ResultsView r={r} certifying={certifying} note={org.resultsNote} />
    </>
  );
}
