import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileText, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { indicatorBoard } from "@/lib/qualiopi-evidence";
import { CRITERIA, INDICATOR_STATUS, findIndicator } from "@/lib/qualiopi";
import { addEvidenceAction, deleteEvidenceAction, saveIndicatorAction } from "@/app/actions/quality";
import { StateForm } from "@/components/StateForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Field, PageHeader } from "@/components/ui";
import { ACCEPT_ATTR } from "@/lib/uploads";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  return { title: `Indicateur ${(await params).code}` };
}

const LEVEL = { ok: { label: "Preuves présentes", tone: "green" }, partial: { label: "Preuves partielles", tone: "blue" }, missing: { label: "Preuves manquantes", tone: "red" }, info: { label: "À documenter", tone: "gray" } } as const;

export default async function IndicatorPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ind = findIndicator(code);
  if (!ind) notFound();
  const user = await requireStaff();
  const orgId = user.organizationId!;
  const [{ rows, version }, evidences, validator] = await Promise.all([
    indicatorBoard(orgId),
    db.qualityEvidence.findMany({ where: { organizationId: orgId, code }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, description: true, url: true, fileName: true, createdAt: true } }),
    db.qualityIndicator.findUnique({ where: { organizationId_code: { organizationId: orgId, code } }, select: { validatedById: true } })
      .then((q) => (q?.validatedById ? db.user.findUnique({ where: { id: q.validatedById }, select: { name: true } }) : null)),
  ]);
  const row = rows.find((r) => r.ind.code === code);
  if (!row) notFound();
  const crit = CRITERIA.find((c) => c.n === ind.criterion)!;
  const st = INDICATOR_STATUS[row.status as keyof typeof INDICATOR_STATUS] ?? INDICATOR_STATUS.TODO;
  const idx = rows.findIndex((r) => r.ind.code === code);
  const prev = rows[idx - 1];
  const next = rows[idx + 1];

  return (
    <>
      <PageHeader
        back={{ href: "/of/qualiopi/indicateurs", label: "Indicateurs" }}
        title={`${ind.code}. ${ind.title}`}
        subtitle={`Critère ${crit.n} · ${crit.title}`}
        actions={<>{!row.applicable ? <Badge>Non applicable</Badge> : <Badge tone={st.tone}>{st.label}</Badge>}{row.stale && <Badge tone="red">Validation de plus d&apos;un an</Badge>}</>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-xl">Ce que l&apos;auditeur attend</h2>
            <p className="mt-2 text-slate-700">{ind.expect}</p>
            {ind.changed2026 && version === "2026" && (
              <p className="mt-4 rounded-[10px] bg-brand-50 p-4 text-sm text-brand-700"><b>Évolution au 1er novembre 2026 :</b> {ind.changed2026}</p>
            )}
            {ind.newEntrant && <p className="mt-3 text-sm text-slate-500">Nouvel entrant : à l&apos;audit initial, seule la formalisation du processus est vérifiée ; sa mise en œuvre l&apos;est à l&apos;audit de surveillance.</p>}
            <h3 className="mt-5 text-base">Preuves habituellement présentées</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{ind.proofs.map((p) => <li key={p}>{p}</li>)}</ul>
            {ind.pitfalls && <p className="mt-4 text-sm text-red-600"><b>Écarts fréquents :</b> {ind.pitfalls}</p>}
            {ind.links && (
              <div className="mt-5 flex flex-wrap gap-2">{ind.links.map((l) => <Link key={l.href} href={l.href} className="btn-secondary btn-sm">{l.label}</Link>)}</div>
            )}
          </section>

          {row.auto && (
            <section className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl">Preuves produites par la plateforme</h2>
                <Badge tone={LEVEL[row.auto.level].tone}>{LEVEL[row.auto.level].label}</Badge>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">{row.auto.facts.map((f) => <li key={f} className="rounded-lg bg-slate-50 px-3 py-2">{f}</li>)}</ul>
              <p className="mt-3 text-xs text-slate-500">Calculées en temps réel sur les 12 derniers mois.</p>
            </section>
          )}

          <section className="card p-6">
            <h2 className="text-xl">Preuves déposées ({evidences.length})</h2>
            {evidences.length === 0 ? <p className="mt-2 text-sm text-slate-500">Aucune preuve déposée pour l&apos;instant.</p> : (
              <ul className="mt-3 divide-y divide-slate-100">
                {evidences.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 py-3">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.75} />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="font-medium text-slate-900">{e.title}</div>
                      {e.description && <p className="whitespace-pre-line text-slate-600">{e.description}</p>}
                      <div className="mt-1 flex flex-wrap gap-3 text-slate-500">
                        <span>{formatDate(e.createdAt)}</span>
                        {e.fileName && <a href={`/api/quality/evidence/${e.id}`} className="link">{e.fileName}</a>}
                        {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">Lien <ExternalLink className="h-3 w-3" /></a>}
                      </div>
                    </div>
                    <form action={deleteEvidenceAction.bind(null, e.id)}>
                      <button className="btn-ghost btn-sm text-red-600" aria-label="Supprimer la preuve"><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-4 rounded-[10px] border border-slate-200 p-4">
              <summary className="cursor-pointer font-medium text-brand-600">Ajouter une preuve</summary>
              <StateForm action={addEvidenceAction.bind(null, code)} submitLabel="Ajouter la preuve" submitClassName="btn-primary" className="mt-4 space-y-3">
                <Field label="Titre"><input name="title" required maxLength={200} className="input" placeholder="Ex. Procédure de traitement des réclamations v2" /></Field>
                <Field label="Description (facultatif)"><textarea name="description" rows={3} className="input" /></Field>
                <Field label="Fichier (4 Mo max.)"><input type="file" name="file" accept={ACCEPT_ATTR.resource} className="text-sm" /></Field>
                <Field label="ou lien (https)"><input name="url" type="url" className="input" placeholder="https://…" /></Field>
              </StateForm>
            </details>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-6">
            <h2 className="text-xl">Suivi et validation</h2>
            {row.status === "VALIDATED" && row.validatedAt && (
              <p className="mt-2 text-sm text-slate-500">Validé le {formatDate(row.validatedAt)}{validator ? ` par ${validator.name}` : ""}.</p>
            )}
            <StateForm action={saveIndicatorAction.bind(null, code)} submitLabel="Enregistrer" submitClassName="btn-secondary" className="mt-4 space-y-4">
              <Field label="Avancement">
                <select name="status" defaultValue={row.status === "VALIDATED" ? "READY" : row.status} className="input">
                  <option value="TODO">À faire</option>
                  <option value="IN_PROGRESS">En cours</option>
                  <option value="READY">Prêt à valider</option>
                </select>
              </Field>
              <Field label="Commentaire (organisation, responsable, points à améliorer)">
                <textarea name="comment" rows={4} defaultValue={row.comment ?? ""} className="input" />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="notApplicable" defaultChecked={!row.applicable} className="mt-1 h-4 w-4" />
                <span>Indicateur non applicable à notre activité</span>
              </label>
              <Field label="Justification de non-applicabilité">
                <input name="notApplicableReason" defaultValue={row.notApplicableReason ?? ""} className="input" placeholder="Ex. aucune action certifiante" />
              </Field>
              <div className="rounded-[10px] bg-slate-50 p-3 text-sm text-slate-600">
                <b>Point de validation :</b> validez quand chaque exigence est couverte par au moins une preuve datée de moins de 12 mois.
              </div>
              <button name="intent" value="validate" className="btn-primary w-full">Valider l&apos;indicateur</button>
            </StateForm>
          </section>
          <nav className="flex justify-between text-sm">
            {prev ? <Link href={`/of/qualiopi/indicateurs/${prev.ind.code}`} className="link">Indicateur {prev.ind.code}</Link> : <span />}
            {next ? <Link href={`/of/qualiopi/indicateurs/${next.ind.code}`} className="link">Indicateur {next.ind.code}</Link> : <span />}
          </nav>
        </aside>
      </div>
    </>
  );
}
