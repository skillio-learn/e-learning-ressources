"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff, requireUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { notify, notifyOrgManagers } from "@/lib/notify";
import { readUpload } from "@/lib/uploads";
import { checkAbsenceAlert } from "@/lib/absences";
import { ABSENCE_KINDS, ABSENCE_REASONS } from "@/lib/labels";
import { optInt, optStr, str } from "@/lib/utils";

export type AState = { error?: string; ok?: string } | undefined;

/** Justificatif d'absence déposé par le stagiaire pour un créneau de sa session. */
export async function justifyAbsenceAction(slotId: string, _: AState, fd: FormData): Promise<AState> {
  const user = await requireUser();
  const slot = await db.attendanceSlot.findUnique({ where: { id: slotId }, include: { session: { select: { id: true, name: true, course: { select: { organizationId: true } } } } } });
  if (!slot) return { error: "Créneau introuvable." };
  const enrollment = await db.enrollment.findFirst({ where: { userId: user.id, sessionId: slot.sessionId } });
  if (!enrollment) return { error: "Vous n'êtes pas inscrit(e) à cette session." };
  const reason = str(fd, "reason");
  if (!ABSENCE_REASONS[reason] || reason === "NON_JUSTIFIE") return { error: "Choisissez un motif." };
  const kind = ABSENCE_KINDS[str(fd, "kind")] ? str(fd, "kind") : "ABSENCE";
  const up = await readUpload(fd, { kind: "document", required: false });
  if ("error" in up) return { error: up.error };
  const existing = await db.absenceRecord.findUnique({ where: { slotId_userId: { slotId, userId: user.id } } });
  if (existing?.status === "ACCEPTED") return { error: "Cette absence est déjà justifiée." };
  const data = {
    kind, reason, comment: optStr(fd, "comment")?.slice(0, 2000) ?? null, minutes: optInt(fd, "minutes"),
    status: "PENDING", declaredBy: "LEARNER", reviewedById: null, reviewedAt: null,
    ...(up.file ? { fileName: up.file.fileName, fileType: up.file.fileType, size: up.file.size, data: up.file.data } : {}),
  };
  if (existing) await db.absenceRecord.update({ where: { id: existing.id }, data });
  else await db.absenceRecord.create({ data: { ...data, slotId, userId: user.id, enrollmentId: enrollment.id } });
  await notifyOrgManagers(slot.session.course.organizationId, "Justificatif d'absence à examiner", `${user.name} · ${slot.session.name}`, `/of/sessions/${slot.sessionId}#absences`);
  await audit("absence.justify", { actorId: user.id, organizationId: slot.session.course.organizationId, entityType: "AttendanceSlot", entityId: slotId });
  revalidatePath("/attendance");
  return { ok: "Justificatif envoyé à votre organisme." };
}

async function slotForStaff(slotId: string) {
  const user = await requireStaff();
  const slot = await db.attendanceSlot.findUniqueOrThrow({ where: { id: slotId }, include: { session: { select: { id: true, courseId: true, course: { select: { organizationId: true } } } } } });
  if (!(await canManageCourse(user, slot.session.courseId))) throw new Error("Accès refusé");
  return { user, slot };
}

/** Déclaration (ou régularisation) d'une absence, d'un retard ou d'un départ anticipé par l'équipe. */
export async function declareAbsenceAction(_: AState, fd: FormData): Promise<AState> {
  const slotId = str(fd, "slotId");
  const { user, slot } = await slotForStaff(slotId);
  const learnerId = str(fd, "userId");
  const enrollment = await db.enrollment.findFirst({ where: { userId: learnerId, sessionId: slot.sessionId } });
  if (!enrollment) return { error: "Stagiaire non inscrit à cette session." };
  const kind = ABSENCE_KINDS[str(fd, "kind")] ? str(fd, "kind") : "ABSENCE";
  const reason = ABSENCE_REASONS[str(fd, "reason")] ? str(fd, "reason") : "NON_JUSTIFIE";
  const status = reason === "NON_JUSTIFIE" ? "REFUSED" : "ACCEPTED";
  const data = { kind, reason, status, comment: optStr(fd, "comment"), minutes: optInt(fd, "minutes"), declaredBy: "STAFF", reviewedById: user.id, reviewedAt: new Date() };
  await db.absenceRecord.upsert({
    where: { slotId_userId: { slotId, userId: learnerId } },
    update: data,
    create: { ...data, slotId, userId: learnerId, enrollmentId: enrollment.id },
  });
  await audit("absence.declare", { actorId: user.id, organizationId: slot.session.course.organizationId, entityType: "AttendanceSlot", entityId: slotId, details: { learnerId, kind, reason } });
  if (status === "REFUSED") await checkAbsenceAlert(enrollment.id);
  revalidatePath(`/of/sessions/${slot.sessionId}`);
  return { ok: "Enregistré." };
}

/** Décision sur un justificatif déposé par le stagiaire. */
export async function reviewAbsenceAction(id: string, accept: boolean) {
  const rec = await db.absenceRecord.findUniqueOrThrow({ where: { id } });
  const { user, slot } = await slotForStaff(rec.slotId);
  await db.absenceRecord.update({ where: { id }, data: { status: accept ? "ACCEPTED" : "REFUSED", reviewedById: user.id, reviewedAt: new Date() } });
  await notify(rec.userId, accept ? "Justificatif d'absence accepté" : "Justificatif d'absence refusé", `Créneau du ${slot.date.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} (${slot.label}).`, "/attendance");
  await audit("absence.review", { actorId: user.id, organizationId: slot.session.course.organizationId, entityType: "AbsenceRecord", entityId: id, details: { accept } });
  if (!accept && rec.enrollmentId) await checkAbsenceAlert(rec.enrollmentId);
  revalidatePath(`/of/sessions/${slot.sessionId}`);
}
