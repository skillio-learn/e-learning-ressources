"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole, requireUser, type CurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/applications";
import { TICKET_CATEGORIES, TICKET_PRIORITY, TICKET_STATUS } from "@/lib/labels";
import { nextTicketNumber, notifySupportTeam, notifyTicketOrg } from "@/lib/tickets";
import { str } from "@/lib/utils";

export type TicketState = { error?: string; ok?: string } | undefined;

const MAX_BODY = 8000;

async function loadTicket(id: string) {
  const t = await db.supportTicket.findUnique({ where: { id } });
  if (!t) throw new Error("Ticket introuvable");
  return t;
}

/** Côté OF : seuls les responsables de l'organisme du ticket y ont accès. */
function ofCanAccess(user: CurrentUser, organizationId: string) {
  return user.role === "OF_ADMIN" && user.organizationId === organizationId;
}

function revalidateTicket(id: string) {
  revalidatePath(`/of/tickets/${id}`);
  revalidatePath("/of/tickets");
  revalidatePath(`/admin/support/${id}`);
  revalidatePath("/admin/support");
}

/** Pièce jointe facultative (capture d'écran, export, courrier…). */
async function readAttachment(fd: FormData): Promise<{ error: string } | { file: null } | { file: { fileName: string; fileType: string; size: number; data: Uint8Array<ArrayBuffer> } }> {
  const f = fd.get("file");
  if (!(f instanceof File) || f.size === 0) return { file: null };
  if (f.size > MAX_UPLOAD_BYTES) return { error: "Pièce jointe trop volumineuse (10 Mo maximum)." };
  const type = f.type || "application/octet-stream";
  if (!ALLOWED_UPLOAD_TYPES.includes(type)) return { error: "Format non accepté : PDF, image (JPG, PNG, WEBP, HEIC) ou document texte." };
  return { file: { fileName: f.name.slice(0, 200), fileType: type, size: f.size, data: new Uint8Array(await f.arrayBuffer()) } };
}

async function rateLimited(userId: string) {
  const recent = await db.supportTicketMessage.count({ where: { authorId: userId, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
  return recent >= 30;
}

// ═══════════════════════════════ Organisme de formation ═══════════════════════════════

export async function openTicketAction(_: TicketState, fd: FormData): Promise<TicketState> {
  const user = await requireRole("OF_ADMIN");
  if (!user.organizationId) return { error: "Votre compte n'est rattaché à aucun organisme." };
  const category = str(fd, "category");
  const priority = str(fd, "priority") as TicketPriority;
  const subject = str(fd, "subject").slice(0, 140);
  const body = str(fd, "body").slice(0, MAX_BODY);
  if (!(category in TICKET_CATEGORIES)) return { error: "Choisissez une catégorie." };
  if (!(priority in TICKET_PRIORITY)) return { error: "Choisissez une priorité." };
  if (subject.length < 4) return { error: "Indiquez un objet explicite." };
  if (body.length < 10) return { error: "Décrivez votre demande (10 caractères minimum)." };
  const opened = await db.supportTicket.count({ where: { requesterId: user.id, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (opened >= 10) return { error: "Trop de tickets ouverts en une heure : réessayez plus tard." };
  const att = await readAttachment(fd);
  if ("error" in att) return { error: att.error };

  const now = Date.now();
  const sla = TICKET_PRIORITY[priority].slaHours;
  const t = await db.supportTicket.create({
    data: {
      number: await nextTicketNumber(),
      organizationId: user.organizationId,
      requesterId: user.id,
      category,
      priority,
      subject,
      messages: {
        create: [
          { authorId: user.id, body, createdAt: new Date(now), ...(att.file ?? {}) },
          {
            system: true,
            fromAdmin: true,
            body: `Ticket enregistré. Priorité ${TICKET_PRIORITY[priority].label.toLowerCase()} : le support Vylia s'engage à vous apporter une première réponse sous ${sla} h.`,
            createdAt: new Date(now + 1), // juste après la demande, avant toute réponse
          },
        ],
      },
    },
  });
  await audit("ticket.open", { actorId: user.id, organizationId: user.organizationId, entityType: "SupportTicket", entityId: t.id, details: { number: t.number, priority, category } });
  const org = await db.organization.findUnique({ where: { id: user.organizationId }, select: { name: true } });
  await notifySupportTeam(t, `${priority === "URGENT" ? "[URGENT] " : ""}Ticket ${t.number} – ${org?.name ?? "OF"}`, `${TICKET_CATEGORIES[category]} : ${subject}`);
  revalidateTicket(t.id);
  redirect(`/of/tickets/${t.id}`);
}

/** Réponse sur un ticket : responsable de l'OF concerné ou administrateur (avec note interne possible). */
export async function replyTicketAction(ticketId: string, _: TicketState, fd: FormData): Promise<TicketState> {
  const user = await requireUser();
  const t = await loadTicket(ticketId);
  const admin = user.role === "ADMIN";
  if (!admin && !ofCanAccess(user, t.organizationId)) return { error: "Accès refusé." };
  if (t.status === "CLOSED") return { error: "Ce ticket est clôturé : ouvrez un nouveau ticket si besoin." };
  const body = str(fd, "body").slice(0, MAX_BODY);
  if (!body) return { error: "Message vide." };
  if (await rateLimited(user.id)) return { error: "Trop de messages envoyés : réessayez dans quelques minutes." };
  const att = await readAttachment(fd);
  if ("error" in att) return { error: att.error };
  const internal = admin && fd.get("internal") === "on";
  const now = new Date();

  // Transitions : réponse publique du support → en attente de l'OF ; message de l'OF → repris par le support
  const status: TicketStatus = internal ? t.status : admin ? "WAITING_OF" : t.assignedToId ? "IN_PROGRESS" : "OPEN";
  await db.$transaction([
    db.supportTicketMessage.create({ data: { ticketId, authorId: user.id, fromAdmin: admin, internal, body, ...(att.file ?? {}) } }),
    db.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...(internal ? {} : { lastMessageAt: now, status }),
        ...(admin && !internal && !t.firstResponseAt ? { firstResponseAt: now } : {}),
        ...(admin && !t.assignedToId ? { assignedToId: user.id } : {}),
        ...(!admin && t.status === "RESOLVED" ? { resolvedAt: null } : {}),
      },
    }),
  ]);
  if (!internal) {
    if (admin) await notifyTicketOrg(t, `Support Vylia – réponse au ticket ${t.number}`, body.slice(0, 240));
    else await notifySupportTeam({ ...t, assignedToId: t.assignedToId }, `Ticket ${t.number} – nouveau message de l'OF`, body.slice(0, 240));
  }
  revalidateTicket(ticketId);
  return { ok: internal ? "Note interne ajoutée." : "Message envoyé." };
}

/** L'OF confirme la résolution (avec avis facultatif) : le ticket est clôturé. */
export async function closeTicketByOfAction(ticketId: string, _: TicketState, fd: FormData): Promise<TicketState> {
  const user = await requireRole("OF_ADMIN");
  const t = await loadTicket(ticketId);
  if (!ofCanAccess(user, t.organizationId)) return { error: "Accès refusé." };
  if (t.status === "CLOSED") return { error: "Ticket déjà clôturé." };
  const r = Number(str(fd, "rating"));
  const rating = Number.isFinite(r) && r >= 1 && r <= 5 ? Math.round(r) : null;
  const ratingComment = str(fd, "ratingComment").slice(0, 1000) || null;
  const now = new Date();
  await db.supportTicket.update({
    where: { id: ticketId },
    data: { status: "CLOSED", closedAt: now, resolvedAt: t.resolvedAt ?? now, rating, ratingComment },
  });
  await db.supportTicketMessage.create({
    data: { ticketId, fromAdmin: false, system: true, body: `Ticket clôturé par ${user.name}${rating ? ` · satisfaction ${rating}/5` : ""}.` },
  });
  await audit("ticket.close", { actorId: user.id, organizationId: t.organizationId, entityType: "SupportTicket", entityId: t.id, details: { rating } });
  await notifySupportTeam(t, `Ticket ${t.number} clôturé par l'OF`, rating ? `Satisfaction : ${rating}/5${ratingComment ? ` – ${ratingComment}` : ""}` : "Résolution confirmée.");
  revalidateTicket(ticketId);
  return { ok: "Ticket clôturé. Merci pour votre retour." };
}

/** L'OF signale que le problème persiste après une résolution. */
export async function reopenTicketByOfAction(ticketId: string) {
  const user = await requireRole("OF_ADMIN");
  const t = await loadTicket(ticketId);
  if (!ofCanAccess(user, t.organizationId) || t.status !== "RESOLVED") throw new Error("Action non autorisée");
  await db.supportTicket.update({ where: { id: ticketId }, data: { status: t.assignedToId ? "IN_PROGRESS" : "OPEN", resolvedAt: null, lastMessageAt: new Date() } });
  await db.supportTicketMessage.create({ data: { ticketId, system: true, body: `Ticket rouvert par ${user.name} : le problème persiste.` } });
  await audit("ticket.reopen", { actorId: user.id, organizationId: t.organizationId, entityType: "SupportTicket", entityId: t.id });
  await notifySupportTeam(t, `Ticket ${t.number} rouvert par l'OF`, "Le problème persiste après la résolution.");
  revalidateTicket(ticketId);
}

// ═══════════════════════════════ Support Vylia (administrateur) ═══════════════════════════════

/** Statut, priorité, catégorie et assignation d'un ticket. Chaque changement est tracé dans le fil. */
export async function updateTicketAction(ticketId: string, _: TicketState, fd: FormData): Promise<TicketState> {
  const admin = await requireRole("ADMIN");
  const t = await loadTicket(ticketId);
  const status = str(fd, "status") as TicketStatus;
  const priority = str(fd, "priority") as TicketPriority;
  const category = str(fd, "category");
  const assignedToId = str(fd, "assignedToId") || null;
  if (!(status in TICKET_STATUS) || !(priority in TICKET_PRIORITY) || !(category in TICKET_CATEGORIES)) return { error: "Valeurs invalides." };
  if (assignedToId && !(await db.user.findFirst({ where: { id: assignedToId, role: "ADMIN", active: true }, select: { id: true } }))) {
    return { error: "Assignation invalide." };
  }
  const changes: string[] = [];
  if (status !== t.status) changes.push(`statut : ${TICKET_STATUS[status].label}`);
  if (priority !== t.priority) changes.push(`priorité : ${TICKET_PRIORITY[priority].label}`);
  if (category !== t.category) changes.push(`catégorie : ${TICKET_CATEGORIES[category]}`);
  if (assignedToId !== t.assignedToId) {
    const who = assignedToId ? await db.user.findUnique({ where: { id: assignedToId }, select: { name: true } }) : null;
    changes.push(who ? `assigné à ${who.name}` : "désassigné");
  }
  if (!changes.length) return { ok: "Aucune modification." };
  const now = new Date();
  await db.supportTicket.update({
    where: { id: ticketId },
    data: {
      status,
      priority,
      category,
      assignedToId,
      ...(status === "RESOLVED" && t.status !== "RESOLVED" ? { resolvedAt: now } : {}),
      ...(status === "CLOSED" && t.status !== "CLOSED" ? { closedAt: now, resolvedAt: t.resolvedAt ?? now } : {}),
      ...(status !== "RESOLVED" && status !== "CLOSED" ? { resolvedAt: null, closedAt: null } : {}),
    },
  });
  await db.supportTicketMessage.create({ data: { ticketId, fromAdmin: true, system: true, authorId: admin.id, body: `${admin.name} – ${changes.join(" · ")}.` } });
  await audit("ticket.update", { actorId: admin.id, organizationId: t.organizationId, entityType: "SupportTicket", entityId: t.id, details: changes.join(" · ") });
  if (status !== t.status && (status === "RESOLVED" || status === "CLOSED")) {
    await notifyTicketOrg(
      t,
      `Ticket ${t.number} ${status === "RESOLVED" ? "résolu" : "clôturé"}`,
      status === "RESOLVED" ? "Le support Vylia a résolu votre demande : confirmez la résolution ou indiquez si le problème persiste." : "Le support Vylia a clôturé votre demande.",
    );
  }
  if (assignedToId && assignedToId !== t.assignedToId && assignedToId !== admin.id) {
    await notifySupportTeam({ id: t.id, assignedToId }, `Ticket ${t.number} assigné`, `${admin.name} vous a assigné ce ticket.`);
  }
  revalidateTicket(ticketId);
  return { ok: "Ticket mis à jour." };
}

export async function takeTicketAction(ticketId: string) {
  const admin = await requireRole("ADMIN");
  const t = await loadTicket(ticketId);
  await db.supportTicket.update({ where: { id: ticketId }, data: { assignedToId: admin.id, ...(t.status === "OPEN" ? { status: "IN_PROGRESS" } : {}) } });
  await db.supportTicketMessage.create({ data: { ticketId, fromAdmin: true, system: true, authorId: admin.id, body: `Ticket pris en charge par ${admin.name}.` } });
  await audit("ticket.update", { actorId: admin.id, organizationId: t.organizationId, entityType: "SupportTicket", entityId: t.id, details: "prise en charge" });
  revalidateTicket(ticketId);
}
