import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { closeTicketByOfAction, reopenTicketByOfAction, replyTicketAction } from "@/app/actions/tickets";
import { StateForm } from "@/components/StateForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AutoRefresh } from "@/components/support/AutoRefresh";
import { TicketComposer } from "@/components/tickets/TicketComposer";
import { TicketThread } from "@/components/tickets/TicketThread";
import { Badge, Container, Field, PageHeader } from "@/components/ui";
import { TICKET_CATEGORIES, TICKET_PRIORITY, TICKET_STATUS } from "@/lib/labels";
import { ticketDueAt } from "@/lib/tickets";
import { formatDate } from "@/lib/utils";

const RATINGS = [[5, "Très satisfait"], [4, "Satisfait"], [3, "Correct"], [2, "Peu satisfait"], [1, "Pas satisfait"]] as const;

export const metadata = { title: "Ticket support" };
export const dynamic = "force-dynamic";

export default async function OfTicket({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("OF_ADMIN");
  const { id } = await params;
  const t = await db.supportTicket.findUnique({
    where: { id },
    include: {
      requester: { select: { name: true } },
      assignedTo: { select: { name: true } },
      messages: {
        where: { internal: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, fromAdmin: true, internal: true, system: true, fileName: true, size: true, readAt: true, createdAt: true, author: { select: { name: true } } },
      },
    },
  });
  if (!t || t.organizationId !== user.organizationId) notFound();
  await db.supportTicketMessage.updateMany({ where: { ticketId: id, fromAdmin: true, internal: false, readAt: null }, data: { readAt: new Date() } });
  const st = TICKET_STATUS[t.status];
  const pr = TICKET_PRIORITY[t.priority];

  return (
    <Container className="max-w-6xl">
      <AutoRefresh />
      <PageHeader
        back={{ href: "/of/tickets", label: "Support Vylia" }}
        title={t.subject}
        subtitle={`${t.number} · ${TICKET_CATEGORIES[t.category] ?? t.category} · ouvert par ${t.requester.name} le ${formatDate(t.createdAt, true)}`}
        actions={<Badge tone={st.tone}>{st.ofLabel}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card flex flex-col p-0">
          <div className="max-h-[62vh] flex-1 overflow-y-auto bg-slate-50/60 p-5">
            <TicketThread messages={t.messages} viewer="of" />
          </div>
          <div className="border-t border-slate-100 p-4">
            {t.status === "CLOSED" ? (
              <p className="text-center text-sm text-slate-500">Ticket clôturé le {formatDate(t.closedAt, true)}. Ouvrez un nouveau ticket si besoin.</p>
            ) : (
              <TicketComposer action={replyTicketAction.bind(null, t.id)} placeholder="Votre message au support Vylia…" />
            )}
          </div>
        </section>
        <aside className="space-y-4">
          <section className="card space-y-2 p-5 text-sm text-slate-600">
            <h2 className="text-base">Suivi</h2>
            <div className="flex items-center justify-between"><span>Priorité</span><Badge tone={pr.tone}>{pr.label}</Badge></div>
            <div className="flex items-center justify-between"><span>Pris en charge par</span><b className="text-slate-900">{t.assignedTo?.name ?? "—"}</b></div>
            <div className="flex items-center justify-between">
              <span>Première réponse</span>
              <b className="text-slate-900">{t.firstResponseAt ? formatDate(t.firstResponseAt, true) : `avant le ${formatDate(ticketDueAt(t), true)}`}</b>
            </div>
            {t.resolvedAt && <div className="flex items-center justify-between"><span>Résolu le</span><b className="text-slate-900">{formatDate(t.resolvedAt, true)}</b></div>}
            {t.rating && <div className="flex items-center justify-between"><span>Votre avis</span><b className="text-slate-900">{t.rating}/5</b></div>}
          </section>
          {t.status === "RESOLVED" && (
            <section className="card space-y-3 p-5 text-sm">
              <h2 className="text-base">Le support a résolu votre demande</h2>
              <p className="text-slate-600">Confirmez la résolution pour clôturer le ticket, ou signalez que le problème persiste.</p>
              <form action={reopenTicketByOfAction.bind(null, t.id)}>
                <SubmitButton className="btn-secondary btn-sm w-full">Le problème persiste</SubmitButton>
              </form>
            </section>
          )}
          {t.status !== "CLOSED" && (
            <section className="card p-5 text-sm">
              <h2 className="mb-3 text-base">Clôturer le ticket</h2>
              <StateForm action={closeTicketByOfAction.bind(null, t.id)} submitLabel="Clôturer" submitClassName="btn-primary btn-sm w-full">
                <Field label="Votre satisfaction">
                  <select name="rating" className="input" defaultValue="">
                    <option value="">— Sans avis —</option>
                    {RATINGS.map(([r, l]) => <option key={r} value={r}>{r}/5 – {l}</option>)}
                  </select>
                </Field>
                <Field label="Commentaire (facultatif)"><textarea name="ratingComment" rows={2} className="input" /></Field>
              </StateForm>
            </section>
          )}
        </aside>
      </div>
    </Container>
  );
}
