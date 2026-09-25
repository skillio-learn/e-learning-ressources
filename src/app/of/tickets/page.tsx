import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { openTicketAction } from "@/app/actions/tickets";
import { StateForm } from "@/components/StateForm";
import { AutoRefresh } from "@/components/support/AutoRefresh";
import { Badge, Container, Empty, Field, PageHeader } from "@/components/ui";
import { TICKET_CATEGORIES, TICKET_PRIORITY, TICKET_STATUS } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Support Vylia" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "active", label: "En cours" },
  { key: "closed", label: "Clôturés" },
] as const;

export default async function OfTickets({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole("OF_ADMIN");
  const orgId = user.organizationId ?? "__none__";
  const { tab: t } = await searchParams;
  const tab = t === "closed" ? "closed" : "active";
  const [org, tickets, counts] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { supportReferent: { select: { id: true, name: true, email: true } } } }),
    db.supportTicket.findMany({
      where: { organizationId: orgId, status: tab === "closed" ? "CLOSED" : { not: "CLOSED" } },
      orderBy: { lastMessageAt: "desc" },
      take: 200,
      include: {
        requester: { select: { name: true } },
        _count: { select: { messages: { where: { fromAdmin: true, internal: false, system: false, readAt: null } } } },
      },
    }),
    db.supportTicket.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: true }),
  ]);
  const n = (keys: string[]) => counts.filter((c) => keys.includes(c.status)).reduce((s, c) => s + c._count, 0);
  const referent = org?.supportReferent;

  return (
    <Container>
      <AutoRefresh ms={30000} />
      <PageHeader
        title="Support Vylia"
        subtitle="Vos demandes d'assistance auprès de l'équipe Vylia : incidents, comptes, facturation, conformité, évolutions."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <div className="mb-4 flex flex-wrap gap-2">
            {TABS.map((x) => (
              <Link
                key={x.key}
                href={`/of/tickets?tab=${x.key}`}
                className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium transition", tab === x.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
              >
                {x.label} <span className="ml-1 tabular-nums opacity-70">{x.key === "closed" ? n(["CLOSED"]) : n(["OPEN", "IN_PROGRESS", "WAITING_OF", "RESOLVED"])}</span>
              </Link>
            ))}
          </div>
          {tickets.length === 0 ? (
            <Empty title={tab === "closed" ? "Aucun ticket clôturé" : "Aucun ticket en cours"}>Ouvrez un ticket pour contacter le support Vylia.</Empty>
          ) : (
            <div className="card divide-y divide-slate-100">
              {tickets.map((tk) => {
                const st = TICKET_STATUS[tk.status];
                const pr = TICKET_PRIORITY[tk.priority];
                return (
                  <Link key={tk.id} href={`/of/tickets/${tk.id}`} className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">{tk.number}</span>
                        <span className="truncate font-medium text-slate-900">{tk.subject}</span>
                        {tk._count.messages > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">{tk._count.messages}</span>}
                      </div>
                      <div className="text-xs text-slate-500">{TICKET_CATEGORIES[tk.category] ?? tk.category} · ouvert par {tk.requester.name} le {formatDate(tk.createdAt)}</div>
                    </div>
                    {tk.priority !== "NORMAL" && <Badge tone={pr.tone}>{pr.label}</Badge>}
                    <Badge tone={st.tone}>{st.ofLabel}</Badge>
                    <span className="w-32 text-right text-xs text-slate-500">{formatDate(tk.lastMessageAt, true)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-1">Nouveau ticket</h2>
            <p className="mb-4 text-xs text-slate-500">Décrivez le contexte, les étapes pour reproduire et joignez une capture si possible.</p>
            <StateForm action={openTicketAction} submitLabel="Envoyer au support" submitClassName="btn-primary w-full">
              <Field label="Catégorie">
                <select name="category" required className="input" defaultValue="">
                  <option value="" disabled>Choisir…</option>
                  {Object.entries(TICKET_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Priorité">
                <select name="priority" className="input" defaultValue="NORMAL">
                  {Object.entries(TICKET_PRIORITY).map(([k, v]) => (
                    <option key={k} value={k}>{v.label} – {v.hint} (réponse sous {v.slaHours} h)</option>
                  ))}
                </select>
              </Field>
              <Field label="Objet"><input name="subject" required maxLength={140} className="input" placeholder="ex. Export CSV des connexions vide" /></Field>
              <Field label="Description"><textarea name="body" required rows={6} className="input" placeholder="Que se passe-t-il ? Depuis quand ? Quels apprenants ou formations sont concernés ?" /></Field>
              <Field label="Pièce jointe (facultatif)" hint="PDF, image ou document · 10 Mo max.">
                <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.odt" className="input" />
              </Field>
            </StateForm>
          </div>
          <div className="card space-y-1 p-5 text-sm text-slate-600">
            <h2 className="mb-1 text-base">Référent support de l&apos;organisme</h2>
            {referent ? (
              <p><b>{referent.name}</b> ({referent.email}) reçoit les réponses du support Vylia sur tous les tickets.</p>
            ) : (
              <p>Aucun référent désigné : chaque responsable suit ses propres tickets. Désignez-en un dans les <Link href="/of/settings" className="link">paramètres de l&apos;OF</Link>.</p>
            )}
          </div>
        </aside>
      </div>
    </Container>
  );
}
