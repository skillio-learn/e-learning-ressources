import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { orgFilter } from "@/lib/permissions";
import { AUDIT_LABELS } from "@/lib/audit";
import { Container, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Journal d'audit" };
export const dynamic = "force-dynamic";

export default async function Audit({ searchParams }: { searchParams: Promise<{ action?: string; page?: string }> }) {
  const user = await requireOfManager();
  const { action, page } = await searchParams;
  const p = Math.max(1, Number(page) || 1);
  const where = { ...orgFilter(user), ...(action ? { action } : {}) };
  const [logs, total, actions] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, skip: (p - 1) * 100, include: { actor: { select: { name: true, role: true } } } }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where: orgFilter(user), distinct: ["action"], select: { action: true } }),
  ]);
  return (
    <Container>
      <PageHeader
        title="Journal d'audit"
        subtitle="Traçabilité de toutes les actions sensibles : décisions sur les dossiers, inscriptions, notes, exports, paramètres."
        actions={<a href="/api/of/reports/audit" className="btn-secondary">⬇ Export CSV</a>}
      />
      <form className="mb-4 flex gap-2">
        <select name="action" defaultValue={action ?? ""} className="input max-w-sm">
          <option value="">Toutes les actions</option>
          {actions.map((a) => <option key={a.action} value={a.action}>{AUDIT_LABELS[a.action] ?? a.action}</option>)}
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Objet</th><th>Détails</th><th>IP</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-xs">{formatDate(l.createdAt, true)}</td>
                <td className="text-xs">{l.actor?.name ?? "—"}</td>
                <td className="text-xs font-medium">{AUDIT_LABELS[l.action] ?? l.action}</td>
                <td className="text-xs text-slate-500">{l.entityType ?? ""}</td>
                <td className="max-w-md truncate text-xs text-slate-500" title={l.details ?? ""}>{l.details ?? ""}</td>
                <td className="text-xs">{l.ip ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>{total} évènement(s)</span>
        <span className="flex gap-2">
          {p > 1 && <a href={`?page=${p - 1}${action ? `&action=${action}` : ""}`} className="btn-ghost btn-sm">← Précédent</a>}
          {p * 100 < total && <a href={`?page=${p + 1}${action ? `&action=${action}` : ""}`} className="btn-ghost btn-sm">Suivant →</a>}
        </span>
      </div>
    </Container>
  );
}
