import Link from "next/link";
import type { Prisma, TicketPriority } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { AutoRefresh } from "@/components/support/AutoRefresh";
import { Badge, Empty, PageHeader, Stat } from "@/components/ui";
import { TICKET_CATEGORIES, TICKET_PRIORITY, TICKET_STATUS } from "@/lib/labels";
import { ticketDueAt, ticketOverdue } from "@/lib/tickets";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Support OF" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "todo", label: "À traiter", where: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
  { key: "mine", label: "Assignés à moi", where: {} },
  { key: "waiting", label: "En attente de l'OF", where: { status: "WAITING_OF" } },
  { key: "resolved", label: "Résolus", where: { status: "RESOLVED" } },
  { key: "closed", label: "Clôturés", where: { status: "CLOSED" } },
] as const satisfies readonly { key: string; label: string; where: Prisma.SupportTicketWhereInput }[];

const PRIORITY_RANK: Record<TicketPriority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

export default async function AdminSupport({ searchParams }: { searchParams: Promise<{ tab?: string; org?: string; priority?: string; q?: string }> }) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const tab = TABS.find((x) => x.key === sp.tab) ?? TABS[0];
  const filters: Prisma.SupportTicketWhereInput = {
    ...(sp.org ? { organizationId: sp.org } : {}),
    ...(sp.priority && sp.priority in TICKET_PRIORITY ? { priority: sp.priority as TicketPriority } : {}),
    ...(sp.q ? { OR: [{ subject: { contains: sp.q, mode: "insensitive" } }, { number: { contains: sp.q, mode: "insensitive" } }] } : {}),
  };
  const tabWhere: Prisma.SupportTicketWhereInput = tab.key === "mine" ? { assignedToId: admin.id, status: { not: "CLOSED" } } : tab.where;
  const since = new Date(Date.now() - 30 * 86400_000);
  const [rows, orgs, active, recent, byTab] = await Promise.all([
    db.supportTicket.findMany({
      where: { ...filters, ...tabWhere },
      orderBy: { lastMessageAt: tab.key === "closed" || tab.key === "resolved" ? "desc" : "asc" },
      take: 300,
      include: {
        organization: { select: { name: true } },
        requester: { select: { name: true } },
        assignedTo: { select: { name: true } },
        _count: { select: { messages: { where: { fromAdmin: false, system: false, readAt: null } } } },
      },
    }),
    db.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.supportTicket.findMany({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_OF"] } }, select: { createdAt: true, priority: true, firstResponseAt: true, status: true } }),
    db.supportTicket.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, firstResponseAt: true, rating: true } }),
    Promise.all(TABS.map((x) => db.supportTicket.count({ where: { ...filters, ...(x.key === "mine" ? { assignedToId: admin.id, status: { not: "CLOSED" } } : x.where) } }))),
  ]);
  if (tab.key === "todo" || tab.key === "mine") {
    rows.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || ticketDueAt(a).getTime() - ticketDueAt(b).getTime());
  }
  const overdue = active.filter(ticketOverdue).length;
  const answered = recent.filter((r) => r.firstResponseAt);
  const avgH = answered.length ? answered.reduce((s, r) => s + (r.firstResponseAt!.getTime() - r.createdAt.getTime()), 0) / answered.length / 3600_000 : null;
  const rated = recent.filter((r) => r.rating);
  const avgRating = rated.length ? rated.reduce((s, r) => s + r.rating!, 0) / rated.length : null;
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ tab: tab.key, org: sp.org, priority: sp.priority, q: sp.q, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/support?${p}`;
  };

  return (
    <div>
      <AutoRefresh ms={30000} />
      <PageHeader title="Support des organismes" subtitle="Tickets ouverts par les référents des OF auprès du support Vylia." />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Tickets actifs" value={active.length} />
        <Stat label="Délai de 1re réponse dépassé" value={<span className={overdue ? "text-red-600" : ""}>{overdue}</span>} />
        <Stat label="1re réponse moyenne (30 j)" value={avgH === null ? "—" : avgH < 1 ? `${Math.round(avgH * 60)} min` : `${avgH.toFixed(1)} h`} />
        <Stat label="Satisfaction (30 j)" value={avgRating === null ? "—" : `${avgRating.toFixed(1)}/5`} hint={`${rated.length} avis`} />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {TABS.map((x, i) => (
          <Link
            key={x.key}
            href={qs({ tab: x.key })}
            className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium transition", tab.key === x.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
          >
            {x.label} <span className="ml-1 tabular-nums opacity-70">{byTab[i]}</span>
          </Link>
        ))}
      </div>
      <form className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="tab" value={tab.key} />
        <input name="q" defaultValue={sp.q} placeholder="N° ou objet…" className="input max-w-[200px]" />
        <select name="org" defaultValue={sp.org ?? ""} className="input w-auto">
          <option value="">Tous les organismes</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select name="priority" defaultValue={sp.priority ?? ""} className="input w-auto">
          <option value="">Toutes priorités</option>
          {Object.entries(TICKET_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>
      {rows.length === 0 ? (
        <Empty title="Aucun ticket" />
      ) : (
        <div className="card divide-y divide-slate-100">
          {rows.map((t) => {
            const st = TICKET_STATUS[t.status];
            const pr = TICKET_PRIORITY[t.priority];
            return (
              <Link key={t.id} href={`/admin/support/${t.id}`} className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">{t.number}</span>
                    <span className="truncate font-medium text-slate-900">{t.subject}</span>
                    {t._count.messages > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">{t._count.messages}</span>}
                  </div>
                  <div className="text-xs text-slate-500">
                    <b className="font-medium text-slate-700">{t.organization.name}</b> · {t.requester.name} · {TICKET_CATEGORIES[t.category] ?? t.category} ·{" "}
                    {t.assignedTo ? `assigné à ${t.assignedTo.name}` : "non assigné"}
                  </div>
                </div>
                {ticketOverdue(t) && <Badge tone="red">Délai dépassé</Badge>}
                <Badge tone={pr.tone}>{pr.label}</Badge>
                <Badge tone={st.tone}>{st.label}</Badge>
                <span className="w-32 text-right text-xs text-slate-500">{formatDate(t.lastMessageAt, true)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
