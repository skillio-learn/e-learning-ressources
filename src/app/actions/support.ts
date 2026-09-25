"use server";

import { revalidatePath } from "next/cache";
import type { SupportStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { isStaff, requireStaff, requireUser, type CurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify, notifyOrgManagers } from "@/lib/notify";
import { SUPPORT_CATEGORIES } from "@/lib/labels";
import { str } from "@/lib/utils";

export type SupportState = { error?: string; ok?: string; id?: string } | undefined;

const MAX_BODY = 4000;

/** Accès d'un membre de l'équipe à une conversation (OF de la conversation, ou support Vylia pour l'admin). */
function staffCanAccess(user: CurrentUser, organizationId: string | null) {
  if (!isStaff(user)) return false;
  if (user.role === "ADMIN") return true;
  return !!organizationId && organizationId === user.organizationId;
}

async function loadConversation(id: string) {
  const c = await db.supportConversation.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, email: true } } } });
  if (!c) throw new Error("Conversation introuvable");
  return c;
}

async function rateLimited(userId: string) {
  const recent = await db.supportMessage.count({ where: { authorId: userId, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
  return recent >= 20;
}

async function notifyTeam(c: { id: string; organizationId: string | null; assignedToId: string | null }, title: string, body: string) {
  const link = `/of/support/${c.id}`;
  if (c.assignedToId) return notify(c.assignedToId, title, body, link);
  if (c.organizationId) return notifyOrgManagers(c.organizationId, title, body, link);
  const admins = await db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
  await Promise.all(admins.map((a) => notify(a.id, title, body, link)));
}

export async function openSupportConversationAction(_: SupportState, fd: FormData): Promise<SupportState> {
  const user = await requireUser();
  const category = str(fd, "category");
  const subject = str(fd, "subject").slice(0, 120);
  const body = str(fd, "body").slice(0, MAX_BODY);
  if (!(category in SUPPORT_CATEGORIES)) return { error: "Choisissez un sujet." };
  if (subject.length < 3) return { error: "Indiquez l'objet de votre demande." };
  if (body.length < 2) return { error: "Écrivez votre message." };
  // L'équipe OF s'adresse au support Vylia ; l'apprenant à son organisme
  const organizationId = isStaff(user) ? null : user.organizationId;
  const org = organizationId
    ? await db.organization.findUnique({ where: { id: organizationId }, select: { name: true, email: true, phone: true, supportEnabled: true, supportHours: true, supportResponseHours: true, supportAutoReply: true } })
    : null;
  if (org && !org.supportEnabled) {
    return { error: `L'assistance en ligne n'est pas activée par ${org.name}. Contact : ${[org.email, org.phone].filter(Boolean).join(" · ") || "voir votre convocation"}.` };
  }
  const openCount = await db.supportConversation.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (openCount >= 5 || (await rateLimited(user.id))) return { error: "Trop de messages envoyés : réessayez dans quelques minutes." };

  const hours = org?.supportResponseHours ?? 24;
  const auto =
    org?.supportAutoReply?.trim() ||
    `Bonjour, votre message a bien été reçu par ${org?.name ?? "l'équipe Vylia"}.${org?.supportHours ? ` Nous répondons ${org.supportHours.charAt(0).toLowerCase()}${org.supportHours.slice(1)}.` : ""} Délai de réponse : ${hours} h ouvrées maximum.`;
  const c = await db.supportConversation.create({
    data: {
      userId: user.id,
      organizationId,
      category,
      subject,
      messages: {
        create: [
          { authorId: user.id, fromStaff: false, body },
          { fromStaff: true, system: true, body: auto, createdAt: new Date(Date.now() + 1000) },
        ],
      },
    },
  });
  await audit("support.open", { actorId: user.id, organizationId, entityType: "SupportConversation", entityId: c.id, details: { category } });
  await notifyTeam(c, `Assistance – ${user.name}`, `${SUPPORT_CATEGORIES[category]} : ${subject}`);
  revalidatePath("/of/support");
  return { ok: "Message envoyé.", id: c.id };
}

export async function sendSupportMessageAction(conversationId: string, _: SupportState, fd: FormData): Promise<SupportState> {
  const user = await requireUser();
  const c = await loadConversation(conversationId);
  const mine = c.userId === user.id;
  if (!mine && !staffCanAccess(user, c.organizationId)) return { error: "Accès refusé." };
  const body = str(fd, "body").slice(0, MAX_BODY);
  if (!body) return { error: "Message vide." };
  if (await rateLimited(user.id)) return { error: "Trop de messages envoyés : réessayez dans quelques minutes." };
  const fromStaff = !mine;
  const now = new Date();
  await db.$transaction([
    db.supportMessage.create({ data: { conversationId, authorId: user.id, fromStaff, body } }),
    db.supportConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
        status: fromStaff ? "WAITING" : "OPEN",
        ...(fromStaff && !c.firstResponseAt ? { firstResponseAt: now } : {}),
        ...(fromStaff && !c.assignedToId ? { assignedToId: user.id } : {}),
        ...(!fromStaff && c.status === "RESOLVED" ? { resolvedAt: null } : {}),
      },
    }),
  ]);
  if (fromStaff) {
    await notify(c.userId, `Réponse de l'assistance : ${c.subject}`, body.slice(0, 200), "/support");
  } else {
    // Évite une rafale de notifications : une par tranche de 10 minutes
    const lastUserMsg = await db.supportMessage.findFirst({
      where: { conversationId, fromStaff: false, createdAt: { lt: now } },
      orderBy: { createdAt: "desc" },
    });
    if (!lastUserMsg || now.getTime() - lastUserMsg.createdAt.getTime() > 10 * 60_000) {
      await notifyTeam(c, `Nouveau message – ${c.user.name}`, body.slice(0, 200));
    }
  }
  revalidatePath(`/of/support/${conversationId}`);
  revalidatePath("/of/support");
  return { ok: "Envoyé." };
}

export async function markSupportReadAction(conversationId: string) {
  const user = await requireUser();
  const c = await loadConversation(conversationId);
  const mine = c.userId === user.id;
  if (!mine && !staffCanAccess(user, c.organizationId)) return;
  await db.supportMessage.updateMany({ where: { conversationId, fromStaff: mine, readAt: null }, data: { readAt: new Date() } });
}

export async function setSupportStatusAction(conversationId: string, status: SupportStatus) {
  const user = await requireUser();
  const c = await loadConversation(conversationId);
  const mine = c.userId === user.id;
  if (!mine && !staffCanAccess(user, c.organizationId)) throw new Error("Accès refusé");
  if (mine && status !== "RESOLVED" && status !== "OPEN") throw new Error("Action non autorisée");
  await db.supportConversation.update({
    where: { id: conversationId },
    data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
  });
  await db.supportMessage.create({
    data: { conversationId, fromStaff: true, system: true, body: status === "RESOLVED" ? `Conversation marquée comme résolue par ${user.name}.` : `Conversation rouverte par ${user.name}.` },
  });
  await audit("support.status", { actorId: user.id, organizationId: c.organizationId, entityType: "SupportConversation", entityId: c.id, details: status });
  revalidatePath(`/of/support/${conversationId}`);
  revalidatePath("/of/support");
}

export async function assignSupportToMeAction(conversationId: string) {
  const user = await requireStaff();
  const c = await loadConversation(conversationId);
  if (!staffCanAccess(user, c.organizationId)) throw new Error("Accès refusé");
  await db.supportConversation.update({ where: { id: conversationId }, data: { assignedToId: user.id } });
  revalidatePath(`/of/support/${conversationId}`);
  revalidatePath("/of/support");
}

export async function rateSupportAction(conversationId: string, rating: number) {
  const user = await requireUser();
  const c = await loadConversation(conversationId);
  if (c.userId !== user.id || c.status !== "RESOLVED") throw new Error("Action non autorisée");
  const r = Math.max(1, Math.min(5, Math.round(rating)));
  await db.supportConversation.update({ where: { id: conversationId }, data: { rating: r } });
}
