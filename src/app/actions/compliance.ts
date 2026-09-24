"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isStaff, requireOfManager, requireStaff, requireUser, type CurrentUser } from "@/lib/auth";
import { canManageCourse, canManageOrg } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { notify, notifyOrgManagers } from "@/lib/notify";
import { appUrl } from "@/lib/email";
import { getClientInfo } from "@/lib/request";
import { FUNDER_QUESTIONS, RESPONDENT_TYPES } from "@/lib/labels";
import { optStr, str } from "@/lib/utils";

export type ActionState = { error?: string; ok?: string } | undefined;

function checkSignature(dataUrl: string) {
  if (!dataUrl.startsWith("data:image/png;base64,") || dataUrl.length < 2000 || dataUrl.length > 400_000) {
    throw new Error("Signature invalide : tracez votre signature dans le cadre.");
  }
}

async function loadEnrollment(enrollmentId: string) {
  const e = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { course: { select: { id: true, title: true, slug: true, organizationId: true } }, user: { select: { id: true, name: true } } },
  });
  if (!e) throw new Error("Inscription introuvable");
  return e;
}

// ─────────────── Convention / contrat & convocation ───────────────

/** Signature électronique de la convention / du contrat par l'apprenant (horodatage + IP). */
export async function signConventionAction(enrollmentId: string, signature: string) {
  const user = await requireUser();
  checkSignature(signature);
  const e = await loadEnrollment(enrollmentId);
  if (e.userId !== user.id) throw new Error("Seul le stagiaire peut signer sa convention");
  if (e.conventionSignedAt) return;
  const { ip } = await getClientInfo();
  await db.enrollment.update({
    where: { id: enrollmentId },
    data: { conventionSignedAt: new Date(), conventionSignature: signature, conventionSignedIp: ip },
  });
  await audit("enrollment.convention_signed", { actorId: user.id, organizationId: e.course.organizationId, entityType: "Enrollment", entityId: enrollmentId });
  await notifyOrgManagers(e.course.organizationId, `Convention signée – ${user.name}`, e.course.title, `/documents/convention/${enrollmentId}`);
  revalidatePath(`/documents/convention/${enrollmentId}`);
}

export async function sendConvocationAction(enrollmentId: string) {
  const user = await requireOfManager();
  const e = await loadEnrollment(enrollmentId);
  if (!canManageOrg(user, e.course.organizationId)) throw new Error("Accès refusé");
  await db.enrollment.update({ where: { id: enrollmentId }, data: { convocationSentAt: new Date() } });
  await notify(
    e.userId,
    `Convocation : ${e.course.title}`,
    `Votre convocation à la formation « ${e.course.title} » est disponible : dates, horaires, modalités d'accès et contacts.`,
    `/documents/convocation/${enrollmentId}`,
  );
  if (!e.conventionSignedAt) {
    await notify(e.userId, "Convention de formation à signer", "Merci de lire et signer électroniquement votre convention / contrat de formation.", `/documents/convention/${enrollmentId}`);
  }
  await audit("enrollment.convocation", { actorId: user.id, organizationId: e.course.organizationId, entityType: "Enrollment", entityId: enrollmentId });
  revalidatePath(`/of/learners/${e.userId}`);
}

export async function saveOrgSignatureAction(orgId: string, signature: string) {
  const user = await requireOfManager();
  if (!canManageOrg(user, orgId)) throw new Error("Accès refusé");
  checkSignature(signature);
  await db.organization.update({ where: { id: orgId }, data: { signatureImage: signature } });
  await audit("organization.update", { actorId: user.id, organizationId: orgId, details: "signature des documents" });
  revalidatePath("/of/settings");
}

export async function clearOrgSignatureAction(orgId: string) {
  const user = await requireOfManager();
  if (!canManageOrg(user, orgId)) throw new Error("Accès refusé");
  await db.organization.update({ where: { id: orgId }, data: { signatureImage: null } });
  revalidatePath("/of/settings");
}

// ─────────────── Positionnement de sortie ───────────────

export async function saveExitAssessmentAction(enrollmentId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const e = await db.enrollment.findUnique({ where: { id: enrollmentId }, include: { course: { select: { skills: true, organizationId: true } } } });
  if (!e || e.userId !== user.id) return { error: "Inscription introuvable." };
  const result: Record<string, number> = {};
  for (const [i, skill] of e.course.skills.entries()) {
    const v = str(fd, `skill_${i}`);
    if (v === "") return { error: `Évaluez : « ${skill} »` };
    result[skill] = Math.max(0, Math.min(4, Number(v)));
  }
  await db.enrollment.update({ where: { id: enrollmentId }, data: { exitAssessment: result } });
  await audit("assessment.exit", { actorId: user.id, organizationId: e.course.organizationId, entityType: "Enrollment", entityId: enrollmentId });
  revalidatePath("/learn", "layout");
  return { ok: "Merci ! Votre auto-évaluation de fin de formation est enregistrée." };
}

// ─────────────── Messagerie pédagogique ───────────────

async function canAccessThread(user: CurrentUser, e: Awaited<ReturnType<typeof loadEnrollment>>) {
  if (e.userId === user.id) return "learner" as const;
  if (isStaff(user) && ((await canManageCourse(user, e.course.id)) || canManageOrg(user, e.course.organizationId))) return "staff" as const;
  return null;
}

export async function sendPedagogicalMessageAction(enrollmentId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const e = await loadEnrollment(enrollmentId);
  const side = await canAccessThread(user, e);
  if (!side) return { error: "Accès refusé." };
  const body = str(fd, "body").slice(0, 5000);
  if (!body) return { error: "Message vide." };
  await db.pedagogicalMessage.create({ data: { enrollmentId, authorId: user.id, fromStaff: side === "staff", body } });
  if (side === "staff") {
    await notify(e.userId, `Réponse de votre formateur – ${e.course.title}`, body.slice(0, 160), `/learn/${e.course.slug}/messages`);
  } else {
    const trainers = await db.courseTrainer.findMany({ where: { courseId: e.course.id }, select: { userId: true } });
    const author = await db.course.findUnique({ where: { id: e.course.id }, select: { authorId: true } });
    const targets = new Set([author?.authorId, ...trainers.map((t) => t.userId)].filter(Boolean) as string[]);
    await Promise.all([...targets].map((id) => notify(id, `Question de ${user.name} – ${e.course.title}`, body.slice(0, 160), `/of/messages/${enrollmentId}`)));
    await notifyOrgManagers(e.course.organizationId, `Question de ${user.name}`, body.slice(0, 160), `/of/messages/${enrollmentId}`);
  }
  await audit("message.pedagogical", { actorId: user.id, organizationId: e.course.organizationId, entityType: "Enrollment", entityId: enrollmentId, details: { side } });
  revalidatePath(`/learn/${e.course.slug}/messages`);
  revalidatePath(`/of/messages/${enrollmentId}`);
  return { ok: "Message envoyé." };
}

/** Marque comme lus les messages de l'autre partie. */
export async function markThreadReadAction(enrollmentId: string) {
  const user = await requireUser();
  const e = await loadEnrollment(enrollmentId);
  const side = await canAccessThread(user, e);
  if (!side) return;
  await db.pedagogicalMessage.updateMany({ where: { enrollmentId, fromStaff: side === "learner", readAt: null }, data: { readAt: new Date() } });
}

// ─────────────── Évaluations à froid & financeurs ───────────────

export async function requestColdEvaluationAction(enrollmentId: string) {
  const user = await requireOfManager();
  const e = await loadEnrollment(enrollmentId);
  if (!canManageOrg(user, e.course.organizationId)) throw new Error("Accès refusé");
  await notify(
    e.userId,
    `Votre avis quelques semaines après la formation`,
    `Comment mettez-vous en pratique « ${e.course.title} » ? Répondez au questionnaire d'évaluation à froid (2 minutes).`,
    `/learn/${e.course.slug}/satisfaction?kind=COLD`,
  );
  await audit("feedback.request", { actorId: user.id, organizationId: e.course.organizationId, entityType: "Enrollment", entityId: enrollmentId, details: "à froid" });
}

export async function createFunderFeedbackAction(enrollmentId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireOfManager();
  const e = await loadEnrollment(enrollmentId);
  if (!canManageOrg(user, e.course.organizationId)) return { error: "Accès refusé." };
  const respondentType = str(fd, "respondentType");
  if (!(respondentType in RESPONDENT_TYPES)) return { error: "Type de répondant invalide." };
  const token = randomBytes(18).toString("base64url");
  await db.funderFeedback.create({
    data: { token, organizationId: e.course.organizationId, enrollmentId, respondentType, respondentName: optStr(fd, "respondentName") },
  });
  await audit("feedback.request", { actorId: user.id, organizationId: e.course.organizationId, entityType: "Enrollment", entityId: enrollmentId, details: respondentType });
  revalidatePath(`/of/learners/${e.userId}`);
  return { ok: `Lien à transmettre : ${appUrl(`/feedback/${token}`)}` };
}

export async function submitFunderFeedbackAction(token: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const fb = await db.funderFeedback.findUnique({ where: { token } });
  if (!fb) return { error: "Lien invalide." };
  if (fb.answeredAt) return { error: "Ce questionnaire a déjà été complété. Merci !" };
  const answers: Record<string, number> = {};
  for (const q of FUNDER_QUESTIONS) {
    const v = Number(fd.get(q.code));
    if (!v || v < 1 || v > 5) return { error: `Merci de noter : « ${q.label} »` };
    answers[q.code] = v;
  }
  const globalScore = Math.round((Object.values(answers).reduce((a, b) => a + b, 0) / FUNDER_QUESTIONS.length) * 100) / 100;
  await db.funderFeedback.update({
    where: { id: fb.id },
    data: { answers, globalScore, comment: optStr(fd, "comment"), respondentName: optStr(fd, "respondentName") ?? fb.respondentName, answeredAt: new Date() },
  });
  await notifyOrgManagers(fb.organizationId, "Nouvelle évaluation financeur / entreprise", `${fb.respondentName ?? RESPONDENT_TYPES[fb.respondentType]} · ${globalScore}/5`, "/of/quality");
  return { ok: "Merci pour votre évaluation !" };
}

// ─────────────── Émargement formateur ───────────────

export async function signSlotAsTrainerAction(slotId: string, signature: string) {
  const user = await requireStaff();
  checkSignature(signature);
  const slot = await db.attendanceSlot.findUnique({ where: { id: slotId }, include: { session: { select: { courseId: true } } } });
  if (!slot || !(await canManageCourse(user, slot.session.courseId))) throw new Error("Accès refusé");
  await db.attendanceSlot.update({ where: { id: slotId }, data: { trainerName: user.name, trainerSignature: signature, trainerSignedAt: new Date() } });
  await audit("attendance.trainer_sign", { actorId: user.id, entityType: "AttendanceSlot", entityId: slotId });
  revalidatePath(`/of/sessions/${slot.sessionId}`);
}
