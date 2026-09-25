"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notifyOrgManagers } from "@/lib/notify";
import { getClientInfo } from "@/lib/request";
import { COMPLAINT_CATEGORIES, SATISFACTION_QUESTIONS } from "@/lib/labels";
import { optStr, str } from "@/lib/utils";

export type ActionState = { error?: string; ok?: string } | undefined;

// ─────────────── Notifications ───────────────

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function openNotificationAction(id: string) {
  const user = await requireUser();
  await db.notification.updateMany({ where: { id, userId: user.id }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

// ─────────────── Émargement électronique ───────────────

export async function signAttendanceAction(slotId: string, signature: string) {
  const user = await requireUser();
  if (!signature.startsWith("data:image/png;base64,") || signature.length < 2000 || signature.length > 400_000) {
    throw new Error("Signature invalide : tracez votre signature dans le cadre.");
  }
  const slot = await db.attendanceSlot.findUnique({
    where: { id: slotId },
    include: { session: { select: { courseId: true, course: { select: { organizationId: true } } } } },
  });
  if (!slot) throw new Error("Créneau introuvable");
  const enrollment = await db.enrollment.findFirst({
    where: { userId: user.id, courseId: slot.session.courseId, sessionId: slot.sessionId, status: { not: "SUSPENDED" }, accessStatus: "GRANTED" },
  });
  if (!enrollment) throw new Error("Vous n'êtes pas inscrit(e) à cette session");
  // Signature possible uniquement le jour du créneau
  const today = new Date().toISOString().slice(0, 10);
  if (slot.date.toISOString().slice(0, 10) !== today) throw new Error("L'émargement n'est possible que le jour du créneau");
  const { ip, userAgent } = await getClientInfo();
  await db.attendanceSignature.upsert({
    where: { slotId_userId: { slotId, userId: user.id } },
    create: { slotId, userId: user.id, signature, ip, userAgent },
    update: {},
  });
  await audit("attendance.sign", { actorId: user.id, organizationId: slot.session.course.organizationId, entityType: "AttendanceSlot", entityId: slotId });
  revalidatePath("/attendance");
}

// ─────────────── Satisfaction ───────────────

export async function submitSatisfactionAction(enrollmentId: string, kind: "HOT" | "COLD", _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { satisfactions: { where: { kind } }, course: { select: { organizationId: true, title: true } } },
  });
  if (!enrollment || enrollment.userId !== user.id) return { error: "Inscription introuvable." };
  if (enrollment.satisfactions.length) return { error: "Vous avez déjà répondu à ce questionnaire. Merci !" };
  const answers: Record<string, number> = {};
  for (const q of SATISFACTION_QUESTIONS) {
    const v = Number(fd.get(q.code));
    if (!v || v < 1 || v > 5) return { error: `Merci de noter : « ${q.label} »` };
    answers[q.code] = v;
  }
  const globalScore = Math.round((Object.values(answers).reduce((a, b) => a + b, 0) / SATISFACTION_QUESTIONS.length) * 100) / 100;
  const rec = str(fd, "recommend");
  await db.satisfactionResponse.create({
        data: {
      enrollmentId,
      kind,
      userId: user.id,
      answers,
      globalScore,
      recommend: rec === "yes" ? true : rec === "no" ? false : null,
      comment: optStr(fd, "comment"),
    },
  });
  await notifyOrgManagers(enrollment.course.organizationId, kind === "COLD" ? "Nouvelle évaluation à froid" : "Nouveau questionnaire de satisfaction", `${user.name} · ${enrollment.course.title} · ${globalScore}/5`, "/of/quality");
  revalidatePath("/learn");
  return { ok: "Merci pour votre retour !" };
}

// ─────────────── Réclamations / demandes ───────────────

export async function createComplaintAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const courseId = optStr(fd, "courseId");
  const category = str(fd, "category");
  const subject = str(fd, "subject");
  const message = str(fd, "message");
  if (!COMPLAINT_CATEGORIES.includes(category)) return { error: "Catégorie invalide." };
  if (subject.length < 3 || message.length < 10) return { error: "Merci de préciser l'objet et votre message." };
  let organizationId: string | null = null;
  if (courseId) {
    const c = await db.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
    organizationId = c?.organizationId ?? null;
  }
  if (!organizationId) {
    const u = await db.user.findUnique({ where: { id: user.id }, select: { organizationId: true } });
    organizationId = u?.organizationId ?? null;
  }
  if (!organizationId) {
    const any = await db.organization.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });
    organizationId = any?.id ?? null;
  }
  if (!organizationId) return { error: "Aucun organisme de rattachement." };
  const c = await db.complaint.create({ data: { userId: user.id, organizationId, courseId, category, subject, message } });
  await notifyOrgManagers(organizationId, `${category} : ${subject}`, `${user.name}`, `/of/quality?complaint=${c.id}`);
  revalidatePath("/support");
  return { ok: "Votre demande a été transmise. Vous serez notifié(e) de la réponse." };
}

// ─────────────── RGPD ───────────────

export async function requestDeletionAction() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { deletionRequestedAt: new Date() } });
  const u = await db.user.findUnique({ where: { id: user.id }, select: { organizationId: true } });
  if (u?.organizationId) {
    await notifyOrgManagers(u.organizationId, "Demande de suppression de compte (RGPD)", user.email, "/of/learners");
  }
  await audit("rgpd.deletion_request", { actorId: user.id, organizationId: u?.organizationId, entityType: "User", entityId: user.id });
  revalidatePath("/profile");
}
