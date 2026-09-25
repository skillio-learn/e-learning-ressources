import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { AUDIT_LABELS } from "@/lib/audit";
import { PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Journal d'audit" };
export const dynamic = "force-dynamic";

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ action?: string; org?: string; page?: string }> }) {
  await requireRole("ADMIN");
  const { action, org, page } = await searchParams;
  const p = Math.max(1, Number(page) || 1);
  const where: Prisma.AuditLogWhereInput = { ...(action ? { action } : {}), ...(org ? { organizationId: org } : {}) };
  const [logs, total, actions, orgs] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      skip: (p - 1) * 100,
      include: { actor: { select: { name: true } }, organization: { select: { name: true } } },
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ["action"], select: { action: true } }),
    db.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const qs = (n: number) => `?${new URLSearchParams(Object.entries({ action, org, page: String(n) }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <div>
      <PageHeader
        title="Journal d'audit"
        subtitle="Toutes les actions sensibles de la plateforme, tous organismes confondus."
        actions={<a href="/api/of/reports/audit" className="btn-secondary">Export CSV</a>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="action" defaultValue={action ?? ""} className="input max-w-sm">
          <option value="">Toutes les actions</option>
          {actions.map((a) => <option key={a.action} value={a.action}>{AUDIT_LABELS[a.action] ?? a.action}</option>)}
        </select>
        <select name="org" defaultValue={org ?? ""} className="input max-w-xs">
          <option value="">Tous les organismes</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Utilisateur</th><th>Organisme</th><th>Action</th><th>Objet</th><th>Détails</th><th>IP</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-xs">{formatDate(l.createdAt, true)}</td>
                <td className="text-xs">{l.actor?.name ?? "—"}</td>
                <td className="text-xs">{l.organization?.name ?? "—"}</td>
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
          {p > 1 && <a href={qs(p - 1)} className="btn-ghost btn-sm">Précédent</a>}
          {p * 100 < total && <a href={qs(p + 1)} className="btn-ghost btn-sm">Suivant</a>}
        </span>
      </div>
    </div>
  );
}
