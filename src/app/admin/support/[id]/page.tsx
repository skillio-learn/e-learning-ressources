import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { replyTicketAction, takeTicketAction, updateTicketAction } from "@/app/actions/tickets";
import { StateForm } from "@/components/StateForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AutoRefresh } from "@/components/support/AutoRefresh";
import { TicketComposer } from "@/components/tickets/TicketComposer";
import { TicketThread } from "@/components/tickets/TicketThread";
import { Badge, Field, PageHeader } from "@/components/ui";
import { TICKET_CATEGORIES, TICKET_PRIORITY, TICKET_STATUS } from "@/lib/labels";
import { ticketDueAt, ticketOverdue } from "@/lib/tickets";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Ticket support" };
export const dynamic = "force-dynamic";

export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  const t = await db.supportTicket.findUnique({
    where: { id },
    include: {
      organization: {
        select: {
          id: true, name: true, city: true, email: true, phone: true, active: true,
          supportReferent: { select: { name: true, email: true } },
          _count: { select: { courses: true, users: true } },
        },
      },
      requester: { select: { name: true, email: true, lastLoginAt: true } },
      assignedTo: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, fromAdmin: true, internal: true, system: true, fileName: true, size: true, readAt: true, createdAt: true, author: { select: { name: true } } },
      },
    },
  });
  if (!t) notFound();
  await db.supportTicketMessage.updateMany({ where: { ticketId: id, fromAdmin: false, readAt: null }, data: { readAt: new Date() } });
  const [admins, history] = await Promise.all([
    db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.supportTicket.findMany({
      where: { organizationId: t.organizationId, id: { not: t.id } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, number: true, subject: true, status: true },
    }),
  ]);
  const st = TICKET_STATUS[t.status];
  const pr = TICKET_PRIORITY[t.priority];

  return (
    <div>
      <AutoRefresh />
      <PageHeader
        back={{ href: "/admin/support", label: "Support des organismes" }}
        title={t.subject}
        subtitle={`${t.number} · ${t.organization.name} · ouvert par ${t.requester.name} le ${formatDate(t.createdAt, true)}`}
        actions={
          <span className="flex gap-2">
            {ticketOverdue(t) && <Badge tone="red">Délai dépassé</Badge>}
            <Badge tone={pr.tone}>{pr.label}</Badge>
            <Badge tone={st.tone}>{st.label}</Badge>
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="card flex flex-col p-0">
          <div className="max-h-[62vh] flex-1 overflow-y-auto bg-slate-50/60 p-5">
            <TicketThread messages={t.messages} viewer="admin" />
          </div>
          <div className="border-t border-slate-100 p-4">
            {t.status === "CLOSED" ? (
              <p className="text-center text-sm text-slate-500">Ticket clôturé le {formatDate(t.closedAt, true)}. Rouvrez-le depuis le panneau de traitement pour répondre.</p>
            ) : (
              <TicketComposer action={replyTicketAction.bind(null, t.id)} placeholder="Votre réponse à l'organisme…" allowInternal />
            )}
          </div>
        </section>
        <aside className="space-y-4">
          <section className="card space-y-3 p-5 text-sm">
            <h2 className="text-base">Traitement</h2>
            <div className="text-slate-600">
              1re réponse :{" "}
              <b className="text-slate-900">{t.firstResponseAt ? formatDate(t.firstResponseAt, true) : `attendue avant le ${formatDate(ticketDueAt(t), true)}`}</b>
            </div>
            {t.assignedTo?.id !== admin.id && (
              <form action={takeTicketAction.bind(null, t.id)}>
                <SubmitButton className="btn-secondary btn-sm w-full">Prendre en charge</SubmitButton>
              </form>
            )}
            <StateForm action={updateTicketAction.bind(null, t.id)} submitLabel="Mettre à jour" submitClassName="btn-primary btn-sm w-full">
              <Field label="Statut">
                <select name="status" defaultValue={t.status} className="input">
                  {Object.entries(TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
              <Field label="Priorité">
                <select name="priority" defaultValue={t.priority} className="input">
                  {Object.entries(TICKET_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.slaHours} h)</option>)}
                </select>
              </Field>
              <Field label="Catégorie">
                <select name="category" defaultValue={t.category} className="input">
                  {Object.entries(TICKET_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Assigné à">
                <select name="assignedToId" defaultValue={t.assignedToId ?? ""} className="input">
                  <option value="">— Personne —</option>
                  {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
            </StateForm>
            {t.rating && (
              <div className="rounded-xl bg-slate-50 p-3 text-slate-600">
                Satisfaction : <b className="text-slate-900">{t.rating}/5</b>
                {t.ratingComment && <p className="mt-1 whitespace-pre-line">{t.ratingComment}</p>}
              </div>
            )}
          </section>
          <section className="card space-y-1 p-5 text-sm text-slate-600">
            <h2 className="mb-1 text-base">Organisme</h2>
            <Link href={`/admin/organizations/${t.organization.id}`} className="link font-medium">{t.organization.name}</Link>
            {!t.organization.active && <Badge tone="red">Désactivé</Badge>}
            <div>{[t.organization.city, t.organization.email, t.organization.phone].filter(Boolean).join(" · ") || "—"}</div>
            <div>{t.organization._count.courses} formation(s) · {t.organization._count.users} compte(s)</div>
            <div className="pt-2">Demandeur : <b className="text-slate-900">{t.requester.name}</b> ({t.requester.email})</div>
            <div>
              Référent support :{" "}
              {t.organization.supportReferent ? <b className="text-slate-900">{t.organization.supportReferent.name}</b> : <span className="text-slate-400">non désigné</span>}
            </div>
          </section>
          {history.length > 0 && (
            <section className="card p-5 text-sm">
              <h2 className="mb-2 text-base">Autres tickets de l&apos;OF</h2>
              <ul className="space-y-1.5">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/support/${h.id}`} className="link truncate">{h.number} · {h.subject}</Link>
                    <Badge tone={TICKET_STATUS[h.status].tone}>{TICKET_STATUS[h.status].label}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
