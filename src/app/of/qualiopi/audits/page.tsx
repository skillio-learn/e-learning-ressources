import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { AUDIT_TYPES, indicatorsFor } from "@/lib/qualiopi";
import { addNonConformityAction, saveAuditAction, setNonConformityStatusAction } from "@/app/actions/quality";
import { StateForm } from "@/components/StateForm";
import { Badge, Empty, Field, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Audits Qualiopi" };
export const dynamic = "force-dynamic";

const RESULT: Record<string, string> = { CERTIFIED: "Certification accordée ou maintenue", CERTIFIED_WITH_NC: "Accordée avec non-conformités", REFUSED: "Refusée ou suspendue" };
const NC_STATUS = { OPEN: { label: "À lever", tone: "red" }, SUBMITTED: { label: "Plan envoyé au certificateur", tone: "blue" }, CLOSED: { label: "Levée", tone: "green" } } as const;
const toInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function Audits() {
  const user = await requireStaff();
  const orgId = user.organizationId!;
  const [org, audits] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { rnqVersion: true, qualiopiDate: true, qualiopiExpiresAt: true, qualiopiCertifier: true } }),
    db.qualityAudit.findMany({ where: { organizationId: orgId }, orderBy: { scheduledAt: "desc" }, include: { nonConformities: { orderBy: { createdAt: "asc" } } } }),
  ]);
  const codes = indicatorsFor(org.rnqVersion).map((i) => i.code);
  // Fenêtre de l'audit de surveillance : entre le 14e et le 22e mois suivant la certification
  const window = org.qualiopiDate ? [new Date(org.qualiopiDate.getTime() + 14 * 30.44 * 86400_000), new Date(org.qualiopiDate.getTime() + 22 * 30.44 * 86400_000)] : null;

  return (
    <>
      <PageHeader title="Audits" subtitle="Planifiez vos audits, enregistrez les non-conformités et suivez leur levée : 3 mois pour une majeure, 6 mois pour une mineure. Cinq mineures non levées valent une majeure." />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card p-5 text-sm"><div className="text-slate-500">Certification obtenue le</div><div className="mt-1 font-medium text-slate-900">{formatDate(org.qualiopiDate)}</div></div>
        <div className="card p-5 text-sm"><div className="text-slate-500">Fenêtre de l&apos;audit de surveillance</div><div className="mt-1 font-medium text-slate-900">{window ? `du ${formatDate(window[0])} au ${formatDate(window[1])}` : "Renseignez la date de certification"}</div></div>
        <div className="card p-5 text-sm"><div className="text-slate-500">Renouvellement avant le</div><div className="mt-1 font-medium text-slate-900">{formatDate(org.qualiopiExpiresAt)}</div></div>
      </div>

      <details className="card p-6" open={!audits.length}>
        <summary className="cursor-pointer text-xl text-brand-600">Planifier un audit</summary>
        <StateForm action={saveAuditAction.bind(null, null)} submitLabel="Enregistrer l'audit" submitClassName="btn-primary" className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Type"><select name="type" className="input">{Object.entries(AUDIT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Date"><input type="date" name="scheduledAt" required className="input" /></Field>
          <Field label="Organisme certificateur"><input name="certifier" defaultValue={org.qualiopiCertifier ?? ""} className="input" /></Field>
          <Field label="Auditeur"><input name="auditor" className="input" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="remote" className="h-4 w-4" /> Audit à distance</label>
        </StateForm>
      </details>

      <div className="mt-6 space-y-4">
        {audits.length === 0 && <Empty title="Aucun audit enregistré" />}
        {audits.map((a) => (
          <section key={a.id} className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl">{AUDIT_TYPES[a.type]?.split(" (")[0] ?? a.type} · {formatDate(a.scheduledAt)}</h2>
                <p className="text-sm text-slate-500">{[a.certifier, a.auditor, a.remote ? "À distance" : "Sur site"].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex gap-2">
                <Badge tone={a.status === "DONE" ? "green" : "blue"}>{a.status === "DONE" ? "Réalisé" : "Planifié"}</Badge>
                {a.result && <Badge tone={a.result === "REFUSED" ? "red" : a.result === "CERTIFIED" ? "gold" : "gray"}>{RESULT[a.result]}</Badge>}
              </div>
            </div>

            {a.nonConformities.length > 0 && (
              <ul className="mt-4 divide-y divide-slate-100 rounded-[10px] border border-slate-200">
                {a.nonConformities.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <Badge tone={n.level === "MAJOR" ? "red" : "gray"}>{n.level === "MAJOR" ? "Majeure" : "Mineure"} · ind. {n.indicatorCode}</Badge>
                    <span className="min-w-0 flex-1">{n.description}{n.dueAt ? <span className="text-slate-500"> · à lever avant le {formatDate(n.dueAt)}</span> : null}</span>
                    <Badge tone={NC_STATUS[n.status as keyof typeof NC_STATUS].tone}>{NC_STATUS[n.status as keyof typeof NC_STATUS].label}</Badge>
                    {n.status !== "SUBMITTED" && n.status !== "CLOSED" && <form action={setNonConformityStatusAction.bind(null, n.id, "SUBMITTED")}><button className="btn-ghost btn-sm">Plan envoyé</button></form>}
                    {n.status !== "CLOSED" && <form action={setNonConformityStatusAction.bind(null, n.id, "CLOSED")}><button className="btn-secondary btn-sm">Marquer levée</button></form>}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <details className="rounded-[10px] border border-slate-200 p-4">
                <summary className="cursor-pointer font-medium text-brand-600">Compte rendu et résultat</summary>
                <StateForm action={saveAuditAction.bind(null, a.id)} submitLabel="Mettre à jour" submitClassName="btn-secondary" className="mt-3 space-y-3">
                  <input type="hidden" name="type" value={a.type} />
                  <input type="hidden" name="certifier" value={a.certifier ?? ""} />
                  <input type="hidden" name="auditor" value={a.auditor ?? ""} />
                  {a.remote && <input type="hidden" name="remote" value="on" />}
                  <Field label="Date"><input type="date" name="scheduledAt" defaultValue={toInput(a.scheduledAt)} className="input" /></Field>
                  <Field label="Statut"><select name="status" defaultValue={a.status} className="input"><option value="PLANNED">Planifié</option><option value="DONE">Réalisé</option></select></Field>
                  <Field label="Résultat"><select name="result" defaultValue={a.result ?? ""} className="input"><option value="">—</option>{Object.entries(RESULT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                  <Field label="Notes (points forts, pistes de progrès)"><textarea name="notes" rows={3} defaultValue={a.notes ?? ""} className="input" /></Field>
                </StateForm>
              </details>
              <details className="rounded-[10px] border border-slate-200 p-4">
                <summary className="cursor-pointer font-medium text-brand-600">Ajouter une non-conformité</summary>
                <StateForm action={addNonConformityAction.bind(null, a.id)} submitLabel="Enregistrer l'écart" submitClassName="btn-secondary" className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Indicateur"><select name="indicatorCode" className="input">{codes.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
                    <Field label="Niveau"><select name="level" className="input"><option value="MINOR">Mineure (6 mois)</option><option value="MAJOR">Majeure (3 mois)</option></select></Field>
                  </div>
                  <Field label="Écart relevé"><textarea name="description" required rows={3} className="input" /></Field>
                  <Field label="Échéance (par défaut selon le niveau)"><input type="date" name="dueAt" className="input" /></Field>
                </StateForm>
              </details>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
