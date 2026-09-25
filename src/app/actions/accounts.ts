"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOfManager, requireUser, type CurrentUser } from "@/lib/auth";
import { canManageOrg } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { notify, notifyOrgManagers } from "@/lib/notify";
import { appUrl, emailEnabled, sendEmail } from "@/lib/email";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/applications";
import { ACCOUNT_DOCUMENT_CHOICES, DOCUMENT_TYPES } from "@/lib/labels";
import { accountChecklist, createActivationLink } from "@/lib/onboarding";
import { optStr, randomCode, str } from "@/lib/utils";

export type ActionState = { error?: string; ok?: string } | undefined;

const MAX_FILES_PER_TYPE = 5;

async function readUpload(fd: FormData): Promise<{ error: string } | { file: File; mime: string }> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Fichier trop volumineux (10 Mo maximum)." };
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_UPLOAD_TYPES.includes(mime)) return { error: "Format non accepté (PDF, JPG, PNG, WEBP, HEIC, DOC, DOCX, ODT)." };
  return { file, mime };
}

function revalidateAccount(userId: string) {
  revalidatePath("/onboarding");
  revalidatePath("/of/accounts");
  revalidatePath(`/of/accounts/${userId}`);
  revalidatePath(`/of/learners/${userId}`);
}

// ─────────────── Côté apprenant ───────────────

export async function uploadAccountDocumentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "LEARNER") return { error: "Réservé aux apprenants." };
  if (user.accountStatus === "REJECTED") return { error: "Votre inscription a été refusée : contactez l'assistance." };
  const type = str(fd, "type");
  if (!(ACCOUNT_DOCUMENT_CHOICES as readonly string[]).includes(type)) return { error: "Type de pièce invalide." };
  const up = await readUpload(fd);
  if ("error" in up) return up;
  const count = await db.learnerDocument.count({ where: { userId: user.id, enrollmentId: null, type, status: { not: "REJECTED" } } });
  if (count >= MAX_FILES_PER_TYPE) return { error: `${MAX_FILES_PER_TYPE} fichiers maximum pour cette pièce.` };
  const doc = await db.learnerDocument.create({
    data: {
      userId: user.id,
      organizationId: user.organizationId,
      type,
      source: "LEARNER_UPLOAD",
      fileName: up.file.name.slice(0, 200),
      fileType: up.mime,
      size: up.file.size,
      data: new Uint8Array(await up.file.arrayBuffer()),
      uploadedById: user.id,
    },
  });
  await audit("learner_document.upload", { actorId: user.id, organizationId: user.organizationId, entityType: "LearnerDocument", entityId: doc.id, details: { type, scope: "compte" } });
  revalidateAccount(user.id);
  return { ok: `${DOCUMENT_TYPES[type].label} déposé(e).` };
}

export async function deleteAccountDocumentAction(documentId: string) {
  const user = await requireUser();
  const doc = await db.learnerDocument.findUnique({ where: { id: documentId } });
  if (!doc || doc.userId !== user.id || doc.enrollmentId) throw new Error("Document introuvable");
  if (doc.status !== "PENDING" || doc.source !== "LEARNER_UPLOAD") throw new Error("Cette pièce ne peut plus être supprimée");
  await db.learnerDocument.delete({ where: { id: documentId } });
  revalidateAccount(user.id);
}

/** Envoi du dossier de compte à l'OF (ou validation immédiate si l'OF ne l'exige pas). */
export async function submitAccountAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "LEARNER") return { error: "Réservé aux apprenants." };
  if (user.accountStatus !== "PENDING_PROFILE") return { error: "Votre dossier a déjà été envoyé." };
  if (fd.get("certify") !== "on") return { error: "Cochez la case certifiant l'exactitude des informations." };
  const { blockers, user: u } = await accountChecklist(user.id);
  if (blockers.length) return { error: blockers.join(" · ") };

  const autoValidate = !!u.organization && !u.organization.requireAccountValidation;
  await db.user.update({
    where: { id: user.id },
    data: autoValidate
      ? { accountStatus: "ACTIVE", accountSubmittedAt: new Date(), accountReviewedAt: new Date(), accountReviewNote: null }
      : { accountStatus: "PENDING_REVIEW", accountSubmittedAt: new Date() },
  });
  await audit("account.submit", { actorId: user.id, organizationId: user.organizationId, entityType: "User", entityId: user.id, details: autoValidate ? "validation automatique" : undefined });
  if (autoValidate) {
    revalidateAccount(user.id);
    redirect("/dashboard");
  }
  const title = `Compte à valider – ${u.name}`;
  const body = `${u.name} (${u.email}) a complété son dossier d'inscription à la plateforme.`;
  if (user.organizationId) await notifyOrgManagers(user.organizationId, title, body, `/of/accounts/${user.id}`);
  else {
    const admins = await db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
    // Apprenant sans organisme : l'administrateur doit le rattacher à un OF qui validera son compte
    await Promise.all(admins.map((a) => notify(a.id, `${title} (sans organisme)`, `${body} Rattachez-le à un organisme de formation.`, `/admin/users?q=${encodeURIComponent(u.email)}`)));
  }
  revalidateAccount(user.id);
  return { ok: "Dossier envoyé ! L'organisme va vérifier vos informations." };
}

// ─────────────── Côté organisme ───────────────

async function loadLearnerForStaff(staff: CurrentUser, learnerId: string) {
  const learner = await db.user.findUnique({ where: { id: learnerId }, select: { id: true, name: true, email: true, role: true, organizationId: true, accountStatus: true } });
  if (!learner || learner.role !== "LEARNER") throw new Error("Apprenant introuvable");
  if (!canManageOrg(staff, learner.organizationId)) throw new Error("Accès refusé");
  return learner;
}

export async function reviewAccountDocumentAction(documentId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireOfManager();
  const doc = await db.learnerDocument.findUnique({ where: { id: documentId } });
  if (!doc || doc.enrollmentId) return { error: "Pièce introuvable." };
  await loadLearnerForStaff(staff, doc.userId);
  const status = str(fd, "status");
  if (status !== "VALIDATED" && status !== "REJECTED") return { error: "Choisissez Valider ou Refuser." };
  const comment = optStr(fd, "comment");
  if (status === "REJECTED" && !comment) return { error: "Indiquez le motif du refus (visible par l'apprenant)." };
  await db.learnerDocument.update({ where: { id: doc.id }, data: { status, comment, reviewedById: staff.id, reviewedAt: new Date() } });
  await audit("learner_document.review", { actorId: staff.id, organizationId: doc.organizationId, entityType: "LearnerDocument", entityId: doc.id, details: { status, type: doc.type } });
  if (status === "REJECTED") {
    await notify(doc.userId, `Pièce refusée : ${DOCUMENT_TYPES[doc.type]?.label ?? doc.type}`, comment, "/onboarding");
  }
  revalidateAccount(doc.userId);
  return { ok: status === "VALIDATED" ? "Pièce validée." : "Pièce refusée, l'apprenant est notifié." };
}

/** Dépôt d'une pièce de compte par l'OF (validée d'office). */
export async function staffUploadAccountDocumentAction(learnerId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireOfManager();
  const learner = await loadLearnerForStaff(staff, learnerId);
  const type = str(fd, "type");
  if (!(ACCOUNT_DOCUMENT_CHOICES as readonly string[]).includes(type)) return { error: "Type de pièce invalide." };
  const up = await readUpload(fd);
  if ("error" in up) return up;
  const doc = await db.learnerDocument.create({
    data: {
      userId: learner.id,
      organizationId: learner.organizationId,
      type,
      source: "STAFF_UPLOAD",
      fileName: up.file.name.slice(0, 200),
      fileType: up.mime,
      size: up.file.size,
      data: new Uint8Array(await up.file.arrayBuffer()),
      uploadedById: staff.id,
      status: "VALIDATED",
      reviewedById: staff.id,
      reviewedAt: new Date(),
    },
  });
  await audit("learner_document.upload", { actorId: staff.id, organizationId: learner.organizationId, entityType: "LearnerDocument", entityId: doc.id, details: { type, scope: "compte", parOF: true } });
  revalidateAccount(learner.id);
  return { ok: `${DOCUMENT_TYPES[type].label} ajouté(e) et validé(e).` };
}

export async function validateAccountAction(learnerId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireOfManager();
  const learner = await loadLearnerForStaff(staff, learnerId);
  if (learner.accountStatus === "ACTIVE") return { ok: "Ce compte est déjà validé." };
  const { missingFields, docs } = await accountChecklist(learner.id);
  if (missingFields.length) return { error: `Informations manquantes : ${missingFields.join(", ")}. Demandez des compléments.` };
  const bad = docs.filter((d) => d.state === "MISSING" || d.state === "REJECTED");
  if (bad.length) return { error: `Pièces manquantes ou refusées : ${bad.map((d) => d.label).join(", ")}.` };
  // Les pièces encore « à vérifier » sont validées avec le compte (décision explicite du gestionnaire)
  await db.$transaction([
    db.learnerDocument.updateMany({
      where: { userId: learner.id, enrollmentId: null, status: "PENDING" },
      data: { status: "VALIDATED", reviewedById: staff.id, reviewedAt: new Date() },
    }),
    db.user.update({
      where: { id: learner.id },
      data: { accountStatus: "ACTIVE", accountReviewedAt: new Date(), accountReviewedById: staff.id, accountReviewNote: optStr(fd, "note") },
    }),
  ]);
  await audit("account.validate", { actorId: staff.id, organizationId: learner.organizationId, entityType: "User", entityId: learner.id });
  await notify(learner.id, "Votre compte est validé", "Bienvenue ! Vous pouvez maintenant accéder à vos formations et déposer vos demandes d'inscription.", "/dashboard");
  // Les inscriptions déjà créées peuvent désormais s'ouvrir automatiquement si leurs pièces sont validées
  const { refreshAccessStatus } = await import("@/lib/onboarding");
  const enrollments = await db.enrollment.findMany({ where: { userId: learner.id, accessStatus: { in: ["PENDING_DOCUMENTS", "UNDER_REVIEW"] } }, select: { id: true } });
  for (const e of enrollments) await refreshAccessStatus(e.id, staff.id);
  revalidateAccount(learner.id);
  return { ok: "Compte validé : l'apprenant a été notifié." };
}

export async function requestAccountChangesAction(learnerId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireOfManager();
  const learner = await loadLearnerForStaff(staff, learnerId);
  const note = str(fd, "note");
  if (note.length < 5) return { error: "Précisez les compléments attendus (visible par l'apprenant)." };
  await db.user.update({
    where: { id: learner.id },
    data: { accountStatus: "PENDING_PROFILE", accountReviewedAt: new Date(), accountReviewedById: staff.id, accountReviewNote: note },
  });
  await audit("account.request_changes", { actorId: staff.id, organizationId: learner.organizationId, entityType: "User", entityId: learner.id, details: note });
  await notify(learner.id, "Compléments demandés sur votre inscription", note, "/onboarding");
  revalidateAccount(learner.id);
  return { ok: "Compléments demandés : l'apprenant a été notifié." };
}

export async function rejectAccountAction(learnerId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireOfManager();
  const learner = await loadLearnerForStaff(staff, learnerId);
  const note = str(fd, "note");
  if (note.length < 5) return { error: "Indiquez le motif du refus (visible par l'apprenant)." };
  if (fd.get("confirm") !== "on") return { error: "Cochez la case de confirmation." };
  await db.user.update({
    where: { id: learner.id },
    data: { accountStatus: "REJECTED", accountReviewedAt: new Date(), accountReviewedById: staff.id, accountReviewNote: note },
  });
  await audit("account.reject", { actorId: staff.id, organizationId: learner.organizationId, entityType: "User", entityId: learner.id, details: note });
  await notify(learner.id, "Votre inscription à la plateforme n'a pas été acceptée", note, "/onboarding");
  revalidateAccount(learner.id);
  return { ok: "Inscription refusée." };
}

export async function reopenAccountAction(learnerId: string) {
  const staff = await requireOfManager();
  const learner = await loadLearnerForStaff(staff, learnerId);
  if (learner.accountStatus !== "REJECTED") return;
  await db.user.update({ where: { id: learner.id }, data: { accountStatus: "PENDING_PROFILE", accountReviewedById: staff.id, accountReviewedAt: new Date() } });
  await audit("account.request_changes", { actorId: staff.id, organizationId: learner.organizationId, entityType: "User", entityId: learner.id, details: "Dossier rouvert" });
  await notify(learner.id, "Votre dossier d'inscription est rouvert", "Vous pouvez compléter et renvoyer votre dossier.", "/onboarding");
  revalidateAccount(learner.id);
}

/** Création d'un compte apprenant par l'OF : l'apprenant reçoit un lien d'activation et complète son dossier. */
export async function createLearnerAccountAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireOfManager();
  const email = str(fd, "email").toLowerCase();
  const firstName = str(fd, "firstName");
  const lastName = str(fd, "lastName").toUpperCase();
  if (!firstName || !lastName) return { error: "Prénom et nom obligatoires." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Email invalide." };
  const organizationId = staff.role === "ADMIN" ? optStr(fd, "organizationId") : staff.organizationId;
  if (!organizationId) return { error: "Choisissez l'organisme de rattachement." };
  if (!canManageOrg(staff, organizationId)) return { error: "Accès refusé." };
  if (await db.user.findUnique({ where: { email } })) return { error: "Un compte existe déjà avec cet email." };
  const civility = optStr(fd, "civility");
  const phone = optStr(fd, "phone");
  const learner = await db.user.create({
    data: {
      email,
      name: `${firstName} ${lastName}`,
      role: "LEARNER",
      organizationId,
      phone,
      passwordHash: await bcrypt.hash(randomCode(24), 10), // inutilisable : l'apprenant définit son mot de passe via le lien
      accountStatus: "PENDING_PROFILE",
      createdVia: "OF",
      profile: { create: { civility, firstName, lastName, phone } },
    },
  });
  const link = await createActivationLink(learner.id);
  await audit("account.invite", { actorId: staff.id, organizationId, entityType: "User", entityId: learner.id });
  let sent = false;
  if (emailEnabled()) {
    sent = await sendEmail(
      email,
      "Activez votre compte de formation",
      `Bonjour ${firstName},\n\nVotre organisme de formation vous a créé un compte. Choisissez votre mot de passe (lien valable 7 jours), puis complétez vos informations administratives.`,
      link,
    );
  }
  revalidatePath("/of/accounts");
  return { ok: `Compte créé. ${sent ? "Un email d'activation a été envoyé. " : ""}Lien d'activation à transmettre (7 jours) : ${appUrl(link)}` };
}

export async function regenerateActivationLinkAction(learnerId: string, _: ActionState, __: FormData): Promise<ActionState> {
  const staff = await requireOfManager();
  const learner = await loadLearnerForStaff(staff, learnerId);
  const link = await createActivationLink(learner.id);
  await audit("account.invite", { actorId: staff.id, organizationId: learner.organizationId, entityType: "User", entityId: learner.id, details: "nouveau lien" });
  return { ok: `Nouveau lien d'activation (7 jours) : ${appUrl(link)}` };
}
