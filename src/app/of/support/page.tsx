import Link from "next/link";
import type { Prisma, SupportStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { AutoRefresh } from "@/components/support/AutoRefresh";
import { Badge, Container, Empty, PageHeader, Stat } from "@/components/ui";
import { SUPPORT_CATEGORIES, SUPPORT_STATUS } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Assistance" };
export const dynamic = "force-dynamic";

const TABS: { key: SupportStatus | "MINE"; label: string }[] = [
  { key: "OPEN", label: "À traiter" },
  { key: "WAITING", label: "Répondu" },
  { key: "RESOLVED", label: "Résolus" },
  { key: "MINE", label: "Assignés à moi" },
];

export default async function OfSupport({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireStaff();
  // Assistance des apprenants : responsables de l'organisme uniquement
  if (user.role !== "OF_ADMIN") notFound();
  const { tab: t } = await searchParams;
  const tab = TABS.find((x) => x.key === t)?.key ?? "OPEN";
  const scope: Prisma.SupportConversationWhereInput =
    { organizationId: user.organizationId ?? "__none__" };
  const org = user.organizationId ? await db.organization.findUnique({ where: { id: user.organizationId }, select: { supportResponseHours: true } }) : null;
  const slaHours = org?.supportResponseHours ?? 24;
  const since = new Date(Date.now() - 30 * 86400_000);
  const [counts, rows, answered] = await Promise.all([
    db.supportConversation.groupBy({ by: ["status"], where: scope, _count: true }),
    db.supportConversation.findMany({
      where: { ...scope, ...(tab === "MINE" ? { assignedToId: user.id, status: { not: "RESOLVED" } } : { status: tab }) },
      orderBy: { lastMessageAt: tab === "OPEN" ? "asc" : "desc" },
      take: 200,
      include: {
        user: { select: { name: true, email: true, accountStatus: true } },
        assignedTo: { select: { name: true } },
        _count: { select: { messages: { where: { fromStaff: false, readAt: null } } } },
      },
    }),
    db.supportConversation.findMany({ where: { ...scope, createdAt: { gte: since }, firstResponseAt: { not: null } }, select: { createdAt: true, firstResponseAt: true, rating: true } }),
  ]);
  const count = (k: string) => (k === "MINE" ? null : counts.find((c) => c.status === k)?._count ?? 0);
  const avgH = answered.length ? answered.reduce((s, c) => s + (c.firstResponseAt!.getTime() - c.createdAt.getTime()), 0) / answered.length / 3600_000 : null;
  const rated = answered.filter((c) => c.rating);
  const avgRating = rated.length ? rated.reduce((s, c) => s + c.rating!, 0) / rated.length : null;
  const overdue = (c: { status: string; firstResponseAt: Date | null; createdAt: Date }) =>
    c.status === "OPEN" && !c.firstResponseAt && Date.now() - c.createdAt.getTime() > slaHours * 3600_000;

  return (
    <Container>
      <AutoRefresh ms={20000} />
      <PageHeader title="Assistance" subtitle={`Conversations du chat d'assistance · engagement de première réponse : ${slaHours} h`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="À traiter" value={count("OPEN") ?? 0} />
        <Stat label="1re réponse moyenne (30 j)" value={avgH === null ? "—" : `${avgH < 1 ? Math.round(avgH * 60) + " min" : avgH.toFixed(1) + " h"}`} />
        <Stat label="Satisfaction" value={avgRating === null ? "—" : `${avgRating.toFixed(1)}/5`} hint={`${rated.length} avis`} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((x) => (
          <Link
            key={x.key}
            href={`/of/support?tab=${x.key}`}
            className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium transition", tab === x.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
          >
            {x.label} {count(x.key) !== null && <span className="ml-1 tabular-nums opacity-70">{count(x.key)}</span>}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty title="Aucune conversation" />
      ) : (
        <div className="card divide-y divide-slate-100">
          {rows.map((c) => (
            <Link key={c.id} href={`/of/support/${c.id}`} className="flex flex-wrap items-center gap-4 p-4 transition hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-slate-900">{c.subject}</span>
                  {c._count.messages > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">{c._count.messages}</span>}
                </div>
                <div className="text-xs text-slate-500">
                  {c.user.name} · {SUPPORT_CATEGORIES[c.category] ?? c.category}{c.assignedTo ? ` · assignée à ${c.assignedTo.name}` : " · non assignée"}
                  {c.user.accountStatus !== "ACTIVE" ? " · compte non validé" : ""}
                </div>
              </div>
              {overdue(c) && <Badge tone="red">Délai dépassé</Badge>}
              <Badge tone={SUPPORT_STATUS[c.status].tone}>{SUPPORT_STATUS[c.status].label}</Badge>
              <span className="w-32 text-right text-xs text-slate-500">{formatDate(c.lastMessageAt, true)}</span>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
