"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOfManager, requireUser, type CurrentUser } from "@/lib/auth";
import { canManageOrg } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { notify, notifyOrgManagers } from "@/lib/notify";
import { getClientInfo } from "@/lib/request";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/applications";
import { ENROLLMENT_DOCUMENTS } from "@/lib/labels";
import { accessChecklist, canESign, refreshAccessStatus, sha256, signedText } from "@/lib/onboarding";
import { optStr, str } from "@/lib/utils";

export type ActionState = { error?: string; ok?: string } | undefined;

async function loadEnrollment(enrollmentId: string) {
  const e = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      user: { select: { id: true, name: true, accountStatus: true } },
      course: { select: { id: true, title: true, slug: true, organizationId: true, organization: true } },
    },
  });
  if (!e) throw new Error("Inscription introuvable");
  return e;
}

/** Apprenant titulaire de l'inscription, ou gestionnaire de l'OF. */
async function actor(enrollmentId: string) {
  const user = await requireUser();
  const e = await loadEnrollment(enrollmentId);
  if (e.userId === user.id) return { user, e, staff: false as const };
  if (canManageOrg(user, e.course.organizationId)) return { user, e, staff: true as const };
  throw new Error("Accès refusé");
}

function revalidate(enrollmentId: string, userId: string) {
  revalidatePath(`/enrollments/${enrollmentId}`);
  revalidatePath(`/of/access/${enrollmentId}`);
  revalidatePath("/of/access");
  revalidatePath(`/of/learners/${userId}`);
  revalidatePath("/dashboard");
}

/** Dépôt d'un document d'inscription : par l'apprenant (à vérifier) ou par l'OF (validé d'office). */
export async function uploadEnrollmentDocumentAction(enrollmentId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { user, e, staff } = await actor(enrollmentId);
  if (!staff && user.accountStatus !== "ACTIVE") return { error: "Votre compte doit d'abord être validé par l'organisme." };
  if (!staff && e.accessStatus === "REFUSED") return { error: "L'accès à cette formation a été refusé : contactez l'assistance." };
  const type = str(fd, "type");
  if (!(type in ENROLLMENT_DOCUMENTS)) return { error: "Type de document invalide." };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Fichier trop volumineux (10 Mo maximum)." };
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_UPLOAD_TYPES.includes(mime)) return { error: "Format non accepté (PDF, JPG, PNG, WEBP, HEIC, DOC, DOCX, ODT)." };
  const live = await db.learnerDocument.count({ where: { enrollmentId, type, status: { not: "REJECTED" } } });
  if (live >= 5) return { error: "5 fichiers maximum pour ce document." };
  const doc = await db.learnerDocument.create({
    data: {
      userId: e.userId,
      organizationId: e.course.organizationId,
      enrollmentId,
      type,
      source: staff ? "STAFF_UPLOAD" : "LEARNER_UPLOAD",
      fileName: file.name.slice(0, 200),
      fileType: mime,
      size: file.size,
      data: new Uint8Array(await file.arrayBuffer()),
      uploadedById: user.id,
      ...(staff ? { status: "VALIDATED" as const, reviewedById: user.id, reviewedAt: new Date() } : {}),
    },
  });
  await audit("learner_document.upload", {
    actorId: user.id, organizationId: e.course.organizationId, entityType: "LearnerDocument", entityId: doc.id, details: { type, enrollmentId, parOF: staff },
  });
  if (!staff) {
    await notifyOrgManagers(
      e.course.organizationId,
      `Document déposé – ${e.user.name}`,
      `${ENROLLMENT_DOCUMENTS[type].label} pour « ${e.course.title} » : à vérifier.`,
      `/of/access/${enrollmentId}`,
    );
  }
  await refreshAccessStatus(enrollmentId, user.id);
  revalidate(enrollmentId, e.userId);
  return { ok: staff ? "Document ajouté et validé." : "Document déposé : l'organisme va le vérifier." };
}

export async function deleteEnrollmentDocumentAction(documentId: string) {
  const user = await requireUser();
  const doc = await db.learnerDocument.findUnique({ where: { id: documentId } });
  if (!doc?.enrollmentId || doc.userId !== user.id) throw new Error("Document introuvable");
  if (doc.status !== "PENDING" || doc.source !== "LEARNER_UPLOAD") throw new Error("Ce document ne peut plus être supprimé");
  await db.learnerDocument.delete({ where: { id: documentId } });
  // Retour éventuel à « documents à fournir »
  const e = await db.enrollment.findUniqueOrThrow({ where: { id: doc.enrollmentId } });
  if (e.accessStatus === "UNDER_REVIEW") await db.enrollment.update({ where: { id: e.id }, data: { accessStatus: "PENDING_DOCUMENTS" } });
  await refreshAccessStatus(doc.enrollmentId, user.id);
  revalidate(doc.enrollmentId, user.id);
}

function checkSignature(dataUrl: string) {
  if (!dataUrl.startsWith("data:image/png;base64,") || dataUrl.length < 2000 || dataUrl.length > 400_000) {
    throw new Error("Signature invalide : tracez votre signature dans le cadre.");
  }
}

/** Signature électronique des CGV ou du règlement intérieur (texte versionné par empreinte SHA-256). */
export async function signEnrollmentDocumentAction(enrollmentId: string, type: string, signature: string) {
  const user = await requireUser();
  const e = await loadEnrollment(enrollmentId);
  if (e.userId !== user.id) throw new Error("Seul l'apprenant peut signer ce document");
  if (user.accountStatus !== "ACTIVE") throw new Error("Votre compte doit d'abord être validé par l'organisme.");
  if (e.accessStatus === "REFUSED") throw new Error("L'accès à cette formation a été refusé.");
  if (ENROLLMENT_DOCUMENTS[type]?.esign !== "text" || !canESign(type, e.course.organization)) throw new Error("Ce document ne peut pas être signé en ligne");
  checkSignature(signature);
  const already = await db.learnerDocument.findFirst({ where: { enrollmentId, type, source: "E_SIGNATURE", status: { not: "REJECTED" } } });
  if (already) return;
  const { ip, userAgent } = await getClientInfo();
  const doc = await db.learnerDocument.create({
    data: {
      userId: user.id,
      organizationId: e.course.organizationId,
      enrollmentId,
      type,
      source: "E_SIGNATURE",
      signature,
      signedIp: ip,
      signedUserAgent: userAgent,
      contentHash: sha256(signedText(type, e.course.organization)),
      signedContent: signedText(type, e.course.organization),
      uploadedById: user.id,
    },
  });
  await audit("learner_document.sign", { actorId: user.id, organizationId: e.course.organizationId, entityType: "LearnerDocument", entityId: doc.id, details: { type } });
  await notifyOrgManagers(e.course.organizationId, `Document signé – ${e.user.name}`, `${ENROLLMENT_DOCUMENTS[type].label} pour « ${e.course.title} » : à vérifier.`, `/of/access/${enrollmentId}`);
  await refreshAccessStatus(enrollmentId, user.id);
  revalidate(enrollmentId, user.id);
}

// ─────────────── Revue et décision de l'OF ───────────────

async function staffEnrollment(staff: CurrentUser, enrollmentId: string) {
  const e = await loadEnrollment(enrollmentId);
  if (!canManageOrg(staff, e.course.organizationId)) throw new Error("Accès refusé");
  return e;
}

export async function reviewEnrollmentDocumentAction(documentId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireOfManager();
  const doc = await db.learnerDocument.findUnique({ where: { id: documentId } });
  if (!doc?.enrollmentId) return { error: "Document introuvable." };
  const e = await staffEnrollment(staff, doc.enrollmentId);
  const status = str(fd, "status");
  if (status !== "VALIDATED" && status !== "REJECTED") return { error: "Choisissez Valider ou Refuser." };
  const comment = optStr(fd, "comment");
  if (status === "REJECTED" && !comment) return { error: "Indiquez le motif du refus (visible par l'apprenant)." };
  await db.learnerDocument.update({ where: { id: doc.id }, data: { status, comment, reviewedById: staff.id, reviewedAt: new Date() } });
  await audit("learner_document.review", { actorId: staff.id, organizationId: e.course.organizationId, entityType: "LearnerDocument", entityId: doc.id, details: { status, type: doc.type } });
  if (status === "REJECTED") {
    await notify(e.userId, `Document refusé : ${ENROLLMENT_DOCUMENTS[doc.type]?.label ?? doc.type}`, `${e.course.title} — ${comment}`, `/enrollments/${e.id}`);
    if (e.accessStatus === "UNDER_REVIEW") await db.enrollment.update({ where: { id: e.id }, data: { accessStatus: "PENDING_DOCUMENTS" } });
    // Convention signée en ligne refusée : l'apprenant doit pouvoir la signer à nouveau
    if (doc.type === "CONVENTION" && doc.source === "E_SIGNATURE") {
      await db.enrollment.update({ where: { id: e.id }, data: { conventionSignedAt: null, conventionSignature: null, conventionSignedIp: null } });
    }
  }
  await refreshAccessStatus(e.id, staff.id);
  revalidate(e.id, e.userId);
  return { ok: status === "VALIDATED" ? "Document validé." : "Document refusé, l'apprenant est notifié." };
}

export async function grantAccessAction(enrollmentId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireOfManager();
  const e = await staffEnrollment(staff, enrollmentId);
  if (e.accessStatus === "GRANTED") return { ok: "L'accès est déjà ouvert." };
  if (e.user.accountStatus !== "ACTIVE") return { error: "Le compte de l'apprenant n'est pas encore validé (Comptes apprenants)." };
  const { items } = await accessChecklist(enrollmentId);
  const pending = items.filter((i) => i.state !== "VALIDATED");
  if (pending.length) return { error: `Documents non validés : ${pending.map((i) => i.label).join(", ")}.` };
  await db.enrollment.update({
    where: { id: enrollmentId },
    data: { accessStatus: "GRANTED", accessDecidedAt: new Date(), accessDecidedById: staff.id, accessDecisionNote: optStr(fd, "note") },
  });
  await audit("access.grant", { actorId: staff.id, organizationId: e.course.organizationId, entityType: "Enrollment", entityId: enrollmentId });
  await notify(e.userId, `Accès ouvert : ${e.course.title}`, "Votre inscription est complète : vous pouvez commencer la formation.", `/learn/${e.course.slug}`);
  revalidate(enrollmentId, e.userId);
  return { ok: "Accès ouvert : l'apprenant a été notifié." };
}

export async function refuseAccessAction(enrollmentId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireOfManager();
  const e = await staffEnrollment(staff, enrollmentId);
  const note = str(fd, "note");
  if (note.length < 5) return { error: "Indiquez le motif du refus (visible par l'apprenant)." };
  if (fd.get("confirm") !== "on") return { error: "Cochez la case de confirmation." };
  const revoke = e.accessStatus === "GRANTED";
  await db.enrollment.update({
    where: { id: enrollmentId },
    data: { accessStatus: "REFUSED", accessDecidedAt: new Date(), accessDecidedById: staff.id, accessDecisionNote: note },
  });
  await audit(revoke ? "access.revoke" : "access.refuse", { actorId: staff.id, organizationId: e.course.organizationId, entityType: "Enrollment", entityId: enrollmentId, details: note });
  await notify(e.userId, revoke ? `Accès suspendu : ${e.course.title}` : `Accès refusé : ${e.course.title}`, note, `/enrollments/${e.id}`);
  revalidate(enrollmentId, e.userId);
  return { ok: revoke ? "Accès retiré." : "Accès refusé." };
}

/** Rouvre le dossier d'accès (après un refus, ou pour redemander des documents). */
export async function reopenAccessAction(enrollmentId: string) {
  const staff = await requireOfManager();
  const e = await staffEnrollment(staff, enrollmentId);
  await db.enrollment.update({ where: { id: enrollmentId }, data: { accessStatus: "PENDING_DOCUMENTS", accessDecidedAt: new Date(), accessDecidedById: staff.id } });
  await audit("access.revoke", { actorId: staff.id, organizationId: e.course.organizationId, entityType: "Enrollment", entityId: enrollmentId, details: "dossier rouvert" });
  await refreshAccessStatus(enrollmentId, staff.id);
  await notify(e.userId, `Dossier d'inscription rouvert : ${e.course.title}`, "Complétez vos documents d'inscription.", `/enrollments/${e.id}`);
  revalidate(enrollmentId, e.userId);
}

/** Inscription d'un apprenant à un parcours par l'OF (l'accès s'ouvre après les documents d'inscription). */
export async function enrollLearnerInCourseAction(learnerId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireOfManager();
  const learner = await db.user.findUnique({ where: { id: learnerId }, select: { id: true, role: true, organizationId: true, name: true } });
  if (!learner || learner.role !== "LEARNER") return { error: "Apprenant introuvable." };
  const course = await db.course.findUnique({ where: { id: str(fd, "courseId") }, include: { organization: { select: { enrollmentRequiredDocuments: true } } } });
  if (!course || !canManageOrg(staff, course.organizationId)) return { error: "Formation invalide." };
  if (learner.organizationId && learner.organizationId !== course.organizationId && staff.role !== "ADMIN") {
    return { error: "Cet apprenant est rattaché à un autre organisme." };
  }
  if (await db.enrollment.findUnique({ where: { userId_courseId: { userId: learner.id, courseId: course.id } } })) {
    return { error: "L'apprenant est déjà inscrit à cette formation." };
  }
  const sessionId = optStr(fd, "sessionId");
  if (sessionId) {
    const s = await db.trainingSession.findUnique({ where: { id: sessionId }, select: { courseId: true } });
    if (s?.courseId !== course.id) return { error: "Session invalide pour cette formation." };
  }
  const startDate = str(fd, "startDate") ? new Date(str(fd, "startDate")) : null;
  const endDate = str(fd, "endDate") ? new Date(str(fd, "endDate")) : null;
  if (startDate && endDate && endDate < startDate) return { error: "La date de fin doit suivre la date de début." };
  const plannedHours = Number(str(fd, "plannedHours")) || null;
  const { initialAccessStatus, announceEnrollment } = await import("@/lib/onboarding");
  const e = await db.enrollment.create({
    data: {
      userId: learner.id,
      courseId: course.id,
      sessionId,
      startDate,
      endDate,
      plannedHours,
      enrolledById: staff.id,
      origin: "OF",
      accessStatus: initialAccessStatus(course.organization, "OF"),
    },
  });
  if (!learner.organizationId) await db.user.update({ where: { id: learner.id }, data: { organizationId: course.organizationId } });
  await audit("enrollment.create", { actorId: staff.id, organizationId: course.organizationId, entityType: "Enrollment", entityId: e.id, details: "inscription par l'OF" });
  await announceEnrollment(e, course);
  revalidatePath(`/of/learners/${learner.id}`);
  revalidatePath("/of/access");
  return { ok: e.accessStatus === "GRANTED" ? "Apprenant inscrit : accès ouvert." : "Apprenant inscrit : il doit maintenant fournir ses documents d'inscription." };
}
