import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkSupportRead } from "@/components/support/MarkSupportRead";
import { db } from "@/lib/db";
import { canHandleSupport, requireStaff } from "@/lib/auth";
import { assignSupportToMeAction, sendSupportMessageAction, setSupportStatusAction } from "@/app/actions/support";
import { Composer } from "@/components/messages/Composer";
import { SubmitButton } from "@/components/SubmitButton";
import { AutoRefresh } from "@/components/support/AutoRefresh";
import { Badge, Container, PageHeader } from "@/components/ui";
import { ACCESS_STATUS, ACCOUNT_STATUS, SUPPORT_CATEGORIES, SUPPORT_STATUS } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Conversation d'assistance" };
export const dynamic = "force-dynamic";

export default async function SupportThread({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const c = await db.supportConversation.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, phone: true, accountStatus: true, role: true, organization: { select: { name: true } },
          enrollments: { select: { id: true, accessStatus: true, course: { select: { title: true } } } },
        },
      },
      assignedTo: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
    },
  });
  if (!c || !canHandleSupport(user, c.organizationId)) notFound();
  const unread = c.messages.filter((m) => !m.fromStaff && !m.readAt).length;
  const st = SUPPORT_STATUS[c.status];
  const acc = ACCOUNT_STATUS[c.user.accountStatus];

  return (
    <Container className="max-w-6xl">
      <AutoRefresh />
      <MarkSupportRead conversationId={c.id} unread={unread} />
      <PageHeader
        back={{ href: "/of/support", label: "Assistance" }}
        title={c.subject}
        subtitle={`${SUPPORT_CATEGORIES[c.category] ?? c.category} · ouverte le ${formatDate(c.createdAt, true)}${c.firstResponseAt ? ` · 1re réponse le ${formatDate(c.firstResponseAt, true)}` : ""}`}
        actions={<Badge tone={st.tone}>{st.label}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card flex flex-col p-0">
          <div className="max-h-[60vh] flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-5">
            {c.messages.map((m) =>
              m.system ? (
                <div key={m.id} className="mx-auto max-w-[85%] rounded-2xl bg-white px-3 py-2 text-center text-xs text-slate-500">{m.body}</div>
              ) : (
                <div key={m.id} className={cn("flex", m.fromStaff ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[78%] rounded-[20px] px-4 py-2.5 text-sm", m.fromStaff ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md bg-white text-slate-900")}>
                    <div className={cn("mb-0.5 text-[11px] font-medium", m.fromStaff ? "text-white/75" : "text-slate-500")}>{m.author?.name ?? "—"}</div>
                    <div className="whitespace-pre-line break-words">{m.body}</div>
                    <div className={cn("mt-0.5 text-right text-[10px]", m.fromStaff ? "text-white/70" : "text-slate-500")}>
                      {formatDate(m.createdAt, true)}{m.fromStaff && m.readAt ? " · lu" : ""}
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
          <div className="border-t border-slate-100 p-4">
            <Composer action={sendSupportMessageAction.bind(null, c.id)} placeholder="Votre réponse…" />
          </div>
        </section>
        <aside className="space-y-6">
          <section className="card p-5 text-sm">
            <h2 className="mb-2 text-base">Demandeur</h2>
            <div className="font-medium text-slate-900">{c.user.name}</div>
            <div className="text-slate-500">{c.user.email}{c.user.phone ? ` · ${c.user.phone}` : ""}</div>
            {c.user.role === "LEARNER" && (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href={`/of/accounts/${c.user.id}`}><Badge tone={acc.tone}>Compte : {acc.label}</Badge></Link>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {c.user.enrollments.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2">
                      <Link href={`/of/access/${e.id}`} className="link truncate">{e.course.title}</Link>
                      <Badge tone={ACCESS_STATUS[e.accessStatus].tone}>{ACCESS_STATUS[e.accessStatus].label}</Badge>
                    </li>
                  ))}
                  {c.user.enrollments.length === 0 && <li className="text-slate-500">Aucune inscription</li>}
                </ul>
                <Link href={`/of/learners/${c.user.id}`} className="btn-secondary btn-sm mt-3 w-full">Fiche apprenant</Link>
              </>
            )}
          </section>
          <section className="card space-y-3 p-5 text-sm">
            <h2 className="text-base">Traitement</h2>
            <div className="text-slate-600">Assignée à : <b>{c.assignedTo?.name ?? "personne"}</b></div>
            {c.assignedTo?.id !== user.id && (
              <form action={assignSupportToMeAction.bind(null, c.id)}>
                <SubmitButton className="btn-secondary btn-sm w-full">M&apos;assigner cette conversation</SubmitButton>
              </form>
            )}
            {c.status !== "RESOLVED" ? (
              <form action={setSupportStatusAction.bind(null, c.id, "RESOLVED")}>
                <SubmitButton className="btn-primary btn-sm w-full">Marquer comme résolue</SubmitButton>
              </form>
            ) : (
              <form action={setSupportStatusAction.bind(null, c.id, "OPEN")}>
                <SubmitButton className="btn-ghost btn-sm w-full">Rouvrir</SubmitButton>
              </form>
            )}
            {c.rating && <div className="text-slate-600">Avis du demandeur : <b>{c.rating}/5</b></div>}
          </section>
        </aside>
      </div>
    </Container>
  );
}
