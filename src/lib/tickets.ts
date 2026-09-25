import "server-only";
import type { SupportTicket } from "@prisma/client";
import { db } from "./db";
import { notify } from "./notify";
import { TICKET_PRIORITY } from "./labels";

export const TICKET_OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_OF"] as const;

export async function nextTicketNumber() {
  const year = new Date().getFullYear();
  const count = await db.supportTicket.count({ where: { number: { startsWith: `TCK-${year}-` } } });
  for (let i = 1; i < 50; i++) {
    const candidate = `TCK-${year}-${String(count + i).padStart(5, "0")}`;
    if (!(await db.supportTicket.findUnique({ where: { number: candidate }, select: { id: true } }))) return candidate;
  }
  return `TCK-${year}-${Date.now()}`;
}

/** Échéance de première réponse selon la priorité. */
export function ticketDueAt(t: Pick<SupportTicket, "createdAt" | "priority">) {
  return new Date(t.createdAt.getTime() + TICKET_PRIORITY[t.priority].slaHours * 3600_000);
}

/** Première réponse non apportée dans le délai d'engagement. */
export function ticketOverdue(t: Pick<SupportTicket, "createdAt" | "priority" | "firstResponseAt" | "status">) {
  return !t.firstResponseAt && t.status !== "CLOSED" && t.status !== "RESOLVED" && Date.now() > ticketDueAt(t).getTime();
}

/** Support Vylia : l'administrateur assigné, sinon tous les administrateurs actifs. */
export async function notifySupportTeam(t: Pick<SupportTicket, "id" | "assignedToId">, title: string, body: string) {
  const link = `/admin/support/${t.id}`;
  if (t.assignedToId) return notify(t.assignedToId, title, body, link);
  const admins = await db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
  await Promise.all(admins.map((a) => notify(a.id, title, body, link)));
}

/** Côté OF : le demandeur et le référent support de l'organisme. */
export async function notifyTicketOrg(t: Pick<SupportTicket, "id" | "requesterId" | "organizationId">, title: string, body: string) {
  const org = await db.organization.findUnique({ where: { id: t.organizationId }, select: { supportReferentId: true } });
  const targets = new Set([t.requesterId, ...(org?.supportReferentId ? [org.supportReferentId] : [])]);
  await Promise.all([...targets].map((id) => notify(id, title, body, `/of/tickets/${t.id}`)));
}
