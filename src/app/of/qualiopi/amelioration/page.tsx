import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { ACTION_SOURCES, indicatorsFor } from "@/lib/qualiopi";
import { deleteRiskAction, saveActionAction, saveRiskAction } from "@/app/actions/quality";
import { StateForm } from "@/components/StateForm";
import { Badge, Empty, Field, PageHeader } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Amélioration continue" };
export const dynamic = "force-dynamic";

const STATUS = { OPEN: { label: "À lancer", tone: "red" }, IN_PROGRESS: { label: "En cours", tone: "gray" }, DONE: { label: "Terminée", tone: "green" }, CANCELLED: { label: "Abandonnée", tone: "gray" } } as const;
const toInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

function ActionFields({ a, team, codes }: { a?: { title: string; source: string; indicatorCode: string | null; description: string | null; ownerId: string | null; dueAt: Date | null; status: string; result: string | null }; team: { id: string; name: string }[]; codes: string[] }) {
  return (
    <>
      <Field label="Action"><input name="title" required defaultValue={a?.title} maxLength={200} className="input" placeholder="Ex. Relancer à J+3 les apprenants inactifs" /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Origine"><select name="source" defaultValue={a?.source ?? "INTERNAL"} className="input">{Object.entries(ACTION_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Indicateur"><select name="indicatorCode" defaultValue={a?.indicatorCode ?? ""} className="input"><option value="">—</option>{codes.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Échéance"><input type="date" name="dueAt" defaultValue={toInput(a?.dueAt ?? null)} className="input" /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Responsable"><select name="ownerId" defaultValue={a?.ownerId ?? ""} className="input"><option value="">—</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Statut"><select name="status" defaultValue={a?.status ?? "OPEN"} className="input">{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      </div>
      <Field label="Constat et analyse"><textarea name="description" rows={2} defaultValue={a?.description ?? ""} className="input" /></Field>
      <Field label="Résultat et efficacité constatée (obligatoire pour clôturer)"><textarea name="result" rows={2} defaultValue={a?.result ?? ""} className="input" /></Field>
    </>
  );
}

export default async function Improvement() {
  const user = await requireStaff();
  const orgId = user.organizationId!;
  const [org, actions, risks, team] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { rnqVersion: true } }),
    db.improvementAction.findMany({ where: { organizationId: orgId }, orderBy: [{ status: "asc" }, { dueAt: "asc" }], include: { owner: { select: { name: true } } } }),
    db.qualityRisk.findMany({ where: { organizationId: orgId } }),
    db.user.findMany({ where: { organizationId: orgId, role: { in: ["OF_ADMIN", "TRAINER"] }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const codes = indicatorsFor(org.rnqVersion).map((i) => i.code);
  const score = (r: { probability: number; impact: number }) => r.probability * r.impact;
  const sortedRisks = [...risks].sort((a, b) => score(b) - score(a));

  return (
    <>
      <PageHeader title="Amélioration continue" subtitle="Chaque avis, réclamation, abandon, écart d'audit ou information de veille peut donner lieu à une action. L'auditeur vérifie le lien entre les constats et les actions, et leur efficacité." />

      <section className="card p-6">
        <h2 className="text-xl">Nouvelle action</h2>
        <StateForm action={saveActionAction.bind(null, null)} submitLabel="Ajouter l'action" submitClassName="btn-primary" className="mt-4 space-y-3">
          <ActionFields team={team} codes={codes} />
        </StateForm>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-xl">Plan d&apos;actions ({actions.length})</h2>
        {actions.length === 0 ? <Empty title="Aucune action pour l'instant">Commencez par les réclamations et les avis négatifs du trimestre.</Empty> : (
          <div className="space-y-3">
            {actions.map((a) => {
              const late = a.dueAt && a.dueAt < new Date() && (a.status === "OPEN" || a.status === "IN_PROGRESS");
              const st = STATUS[a.status as keyof typeof STATUS];
              return (
                <details key={a.id} className="card p-5">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-900">{a.title}</span>
                      <span className="text-sm text-slate-500">
                        {ACTION_SOURCES[a.source] ?? a.source}{a.indicatorCode ? ` · indicateur ${a.indicatorCode}` : ""}{a.owner ? ` · ${a.owner.name}` : ""}{a.dueAt ? ` · échéance ${formatDate(a.dueAt)}` : ""}
                      </span>
                    </span>
                    {late && <Badge tone="red">En retard</Badge>}
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </summary>
                  <StateForm action={saveActionAction.bind(null, a.id)} submitLabel="Mettre à jour" submitClassName="btn-secondary" className="mt-4 space-y-3">
                    <ActionFields a={a} team={team} codes={codes} />
                  </StateForm>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl">Analyse des risques qualité</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          {org.rnqVersion === "2026" ? "Exigée par l'indicateur 32 du référentiel 2026 : " : ""}identifiez ce qui pourrait dégrader vos prestations (abandons, indisponibilité d&apos;un formateur, incident technique…), cotez probabilité et impact de 1 à 4, et décrivez vos mesures de maîtrise. Revoyez-la au moins une fois par an.
        </p>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Risque</th><th>Processus</th><th>Criticité</th><th>Mesures de maîtrise</th><th>Revu le</th><th /></tr></thead>
            <tbody>
              {sortedRisks.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-slate-900">{r.title}</td>
                  <td>{r.process ?? "—"}</td>
                  <td><span className={cn("badge", score(r) >= 9 ? "bg-red-50 text-red-600" : score(r) >= 4 ? "bg-slate-100 text-slate-700" : "bg-emerald-50 text-emerald-600")}>{score(r)} ({r.probability} × {r.impact})</span></td>
                  <td className="max-w-md whitespace-pre-line">{r.mitigation ?? "—"}</td>
                  <td className="whitespace-nowrap">{formatDate(r.reviewedAt)}</td>
                  <td><form action={deleteRiskAction.bind(null, r.id)}><button className="btn-ghost btn-sm text-red-600">Supprimer</button></form></td>
                </tr>
              ))}
              {!risks.length && <tr><td colSpan={6} className="text-slate-500">Aucun risque cartographié.</td></tr>}
            </tbody>
          </table>
        </div>
        <details className="card mt-3 p-5">
          <summary className="cursor-pointer font-medium text-brand-600">Ajouter un risque</summary>
          <StateForm action={saveRiskAction.bind(null, null)} submitLabel="Ajouter le risque" submitClassName="btn-primary" className="mt-4 space-y-3">
            <Field label="Risque"><input name="title" required className="input" placeholder="Ex. Abandon en cours de parcours à distance" /></Field>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Processus"><input name="process" className="input" placeholder="Suivi" /></Field>
              <Field label="Probabilité (1 à 4)"><input name="probability" type="number" min={1} max={4} defaultValue={2} className="input" /></Field>
              <Field label="Impact (1 à 4)"><input name="impact" type="number" min={1} max={4} defaultValue={2} className="input" /></Field>
              <Field label="Pilote"><input name="ownerName" className="input" /></Field>
            </div>
            <Field label="Mesures de maîtrise"><textarea name="mitigation" rows={2} className="input" /></Field>
          </StateForm>
        </details>
      </section>
    </>
  );
}
