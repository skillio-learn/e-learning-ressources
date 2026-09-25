"use server";

import { createWithUniqueNumber } from "@/lib/numbering";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ApplicationStatus, EmploymentStatus, FundingType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireActiveLearnerAccount, requireOfManager, requireUser, type CurrentUser } from "@/lib/auth";
import { announceEnrollment, initialAccessStatus } from "@/lib/onboarding";
import { canManageOrg } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { notify, notifyOrgManagers } from "@/lib/notify";
import {
  ACTIVE_STATUSES,
  EDITABLE_STATUSES,
  STAFF_TRANSITIONS,
  applicationBlockers,
  nextApplicationNumber,
} from "@/lib/applications";
import { APPLICATION_STATUS, DOCUMENT_TYPES, FUNDING_TYPES, learnerProfileEditable } from "@/lib/labels";
import { parseProfileForm } from "@/lib/profile";
import { readUpload } from "@/lib/uploads";
import { bool, optFloat, optStr, str } from "@/lib/utils";

export type ActionState = { error?: string; ok?: string } | undefined;

async function loadApp(id: string) {
  const app = await db.application.findUnique({
    where: { id },
    include: { course: { select: { id: true, title: true, slug: true, organizationId: true } } },
  });
  if (!app) throw new Error("Dossier introuvable");
  return app;
}

async function loadOwnApp(id: string, user: CurrentUser) {
  const app = await loadApp(id);
  if (app.userId !== user.id) throw new Error("Dossier introuvable");
  return app;
}

async function loadStaffApp(id: string, user: CurrentUser) {
  const app = await loadApp(id);
  if (!canManageOrg(user, app.course.organizationId)) throw new Error("Accès refusé");
  return app;
}

function revalidateApp(id: string) {
  revalidatePath(`/applications/${id}`);
  revalidatePath(`/of/applications/${id}`);
  revalidatePath("/of/applications");
  revalidatePath("/applications");
}

// ═══════════════════════════════ Apprenant ═══════════════════════════════

export async function startApplicationAction(courseId: string) {
  // La candidature suppose un compte validé par l'OF
  const user = await requireActiveLearnerAccount();
  const course = await db.course.findUnique({ where: { id: String(courseId) }, select: { id: true, status: true, enrollmentPolicy: true, organizationId: true } });
  if (!course || course.status !== "PUBLISHED") throw new Error("Formation indisponible");
  // Pas de catalogue : candidature uniquement sur une formation « sur dossier » de son propre organisme
  if (course.enrollmentPolicy !== "APPLICATION" || course.organizationId !== user.organizationId) throw new Error("Formation indisponible");
  const existing = await db.application.findFirst({
    where: { userId: user.id, courseId, status: { in: ACTIVE_STATUSES } },
    select: { id: true },
  });
  if (existing) redirect(`/applications/${existing.id}`);
  const enrolled = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } });
  if (enrolled) throw new Error("Vous êtes déjà inscrit(e) à cette formation");

  const app = await createWithUniqueNumber(nextApplicationNumber, (number) => db.application.create({
    data: {
      number,
      userId: user.id,
      courseId,
      events: { create: { type: "STATUS", toStatus: "DRAFT", authorId: user.id, message: "Dossier de candidature créé" } },
    },
  }));
  if (user.role === "LEARNER") {
    const org = await db.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
    const u = await db.user.findUnique({ where: { id: user.id }, select: { organizationId: true } });
    if (!u?.organizationId && org) await db.user.update({ where: { id: user.id }, data: { organizationId: org.organizationId } });
  }
  redirect(`/applications/${app.id}`);
}

/** Sans catalogue, c'est l'OF qui ouvre le dossier de candidature d'un apprenant sur une formation. */
export async function openApplicationForLearnerAction(learnerId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireOfManager();
  const learner = await db.user.findUnique({ where: { id: learnerId }, select: { id: true, role: true, organizationId: true } });
  if (!learner || learner.role !== "LEARNER") return { error: "Apprenant introuvable." };
  const course = await db.course.findUnique({ where: { id: str(fd, "courseId") }, select: { id: true, title: true, status: true, organizationId: true } });
  if (!course || course.status !== "PUBLISHED" || !canManageOrg(staff, course.organizationId)) return { error: "Formation invalide." };
  if (learner.organizationId && learner.organizationId !== course.organizationId && staff.role !== "ADMIN") {
    return { error: "Cet apprenant est rattaché à un autre organisme." };
  }
  if (await db.enrollment.findUnique({ where: { userId_courseId: { userId: learner.id, courseId: course.id } } })) {
    return { error: "L'apprenant est déjà inscrit à cette formation." };
  }
  if (await db.application.findFirst({ where: { userId: learner.id, courseId: course.id, status: { in: ACTIVE_STATUSES } }, select: { id: true } })) {
    return { error: "Un dossier est déjà en cours pour cette formation." };
  }
  const app = await createWithUniqueNumber(nextApplicationNumber, (number) => db.application.create({
    data: {
      number,
      userId: learner.id,
      courseId: course.id,
      events: { create: { type: "STATUS", toStatus: "DRAFT", authorId: staff.id, message: "Dossier de candidature ouvert par l'organisme" } },
    },
  }));
  if (!learner.organizationId) await db.user.update({ where: { id: learner.id }, data: { organizationId: course.organizationId } });
  await audit("application.create", { actorId: staff.id, organizationId: course.organizationId, entityType: "Application", entityId: app.id, details: "ouvert par l'OF" });
  await notify(learner.id, `Dossier de candidature : ${course.title}`, "Votre organisme a ouvert votre dossier : complétez vos informations et déposez vos justificatifs.", `/applications/${app.id}`);
  revalidatePath(`/of/learners/${learner.id}`);
  revalidatePath("/of/applications");
  return { ok: `Dossier ${app.number} ouvert : l'apprenant est notifié.` };
}

function dateOrNull(v: string) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Profil administratif : saisi par l'apprenant pendant la constitution de son dossier de compte uniquement.
 * Une fois le dossier envoyé ou validé, toute modification passe par une demande à l'OF (anti-fraude).
 */
export async function saveProfileAction(applicationId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "LEARNER") return { error: "Réservé aux apprenants." };
  if (!learnerProfileEditable(user.accountStatus)) {
    return { error: "Vos informations sont verrouillées depuis la validation de votre dossier. Demandez une modification depuis « Mon profil »." };
  }
  if (applicationId) {
    const app = await loadOwnApp(applicationId, user);
    if (!EDITABLE_STATUSES.includes(app.status)) return { error: "Ce dossier n'est plus modifiable." };
  }
  const parsed = parseProfileForm(fd);
  if ("error" in parsed) return parsed;
  const data = parsed.data;
  await db.learnerProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  if (data.firstName && data.lastName) {
    await db.user.update({ where: { id: user.id }, data: { name: `${data.firstName} ${data.lastName}`, phone: data.phone } });
  }
  if (applicationId) revalidateApp(applicationId);
  revalidatePath("/profile");
  revalidatePath("/onboarding");
  return { ok: "Informations enregistrées." };
}

export async function saveApplicationDetailsAction(applicationId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const app = await loadOwnApp(applicationId, user);
  if (!EDITABLE_STATUSES.includes(app.status)) return { error: "Ce dossier n'est plus modifiable." };
  const sessionId = optStr(fd, "sessionId");
  if (sessionId) {
    const s = await db.trainingSession.findUnique({ where: { id: sessionId }, select: { courseId: true, open: true, capacity: true, _count: { select: { enrollments: true } } } });
    if (!s || s.courseId !== app.courseId || !s.open) return { error: "Session invalide ou fermée." };
    if (s.capacity && s._count.enrollments >= s.capacity) return { error: "Cette session est complète, choisissez-en une autre." };
  }
    const fundingType = (str(fd, "fundingType") || null) as FundingType | null;
  if (fundingType && !(fundingType in FUNDING_TYPES)) return { error: "Financement invalide." };
  const course = await db.course.findUnique({ where: { id: app.courseId }, select: { skills: true } });
  const positioning: Record<string, number> = {};
  (course?.skills ?? []).forEach((skill, i) => {
    const v = str(fd, `skill_${i}`);
    if (v !== "") positioning[skill] = Math.max(0, Math.min(4, Number(v)));
  });
  await db.application.update({
    where: { id: applicationId },
    data: {
      sessionId,
      fundingType,
      fundingReference: optStr(fd, "fundingReference"),
      fundingDetails: optStr(fd, "fundingDetails"),
      motivation: optStr(fd, "motivation"),
      expectations: optStr(fd, "expectations"),
      experience: optStr(fd, "experience"),
      availability: optStr(fd, "availability"),
            prerequisitesOk: bool(fd, "prerequisitesOk"),
      positioning,
    },
  });
  revalidateApp(applicationId);
  return { ok: "Projet de formation enregistré." };
}

export async function uploadDocumentAction(applicationId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const app = await loadOwnApp(applicationId, user);
  if (!EDITABLE_STATUSES.includes(app.status)) return { error: "Ce dossier n'est plus modifiable." };
  const type = str(fd, "type");
  if (!(type in DOCUMENT_TYPES)) return { error: "Type de justificatif invalide." };
  const up = await readUpload(fd);
  if ("error" in up) return up;
  const file = up.file!;

    // Plusieurs fichiers possibles par justificatif (ex. recto / verso), 5 maximum
  const count = await db.applicationDocument.count({ where: { applicationId, type, status: { not: "REJECTED" } } });
  if (count >= 5) return { error: "5 fichiers maximum pour ce justificatif." };
  await db.applicationDocument.create({
    data: {
      applicationId,
      type,
      fileName: file.fileName,
      fileType: file.fileType,
      size: file.size,
      data: file.data,
    },
  });
  await db.applicationEvent.create({
    data: { applicationId, type: "DOCUMENT", authorId: user.id, message: `Justificatif déposé : ${DOCUMENT_TYPES[type].label} (${file.fileName})` },
  });
  revalidateApp(applicationId);
  return { ok: `${DOCUMENT_TYPES[type].label} déposé(e).` };
}

export async function deleteDocumentAction(documentId: string) {
  const user = await requireUser();
  const doc = await db.applicationDocument.findUnique({ where: { id: documentId }, include: { application: true } });
  if (!doc || doc.application.userId !== user.id) throw new Error("Document introuvable");
  if (!EDITABLE_STATUSES.includes(doc.application.status) || doc.status === "VALIDATED") {
    throw new Error("Ce justificatif ne peut plus être supprimé");
  }
  await db.applicationDocument.delete({ where: { id: documentId } });
  revalidateApp(doc.applicationId);
}

export async function submitApplicationAction(applicationId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const app = await loadOwnApp(applicationId, user);
  if (!EDITABLE_STATUSES.includes(app.status)) return { error: "Ce dossier a déjà été déposé." };
  if (!bool(fd, "consentRgpd") || !bool(fd, "consentTerms") || !bool(fd, "certify")) {
    return { error: "Merci de cocher les trois attestations et consentements." };
  }
  const { blockers } = await applicationBlockers(applicationId);
  if (blockers.length) return { error: `Dossier incomplet :\n• ${blockers.join("\n• ")}` };

  const profile = await db.learnerProfile.findUnique({ where: { userId: user.id } });
  const from = app.status;
  const now = new Date();
  await db.application.update({
    where: { id: applicationId },
    data: {
      status: "SUBMITTED",
      submittedAt: now,
      consentRgpd: true,
      consentTerms: true,
      consentAt: now,
      profileSnapshot: profile ? JSON.parse(JSON.stringify(profile)) : undefined,
      events: {
        create: {
          type: "STATUS",
          fromStatus: from,
          toStatus: "SUBMITTED",
          authorId: user.id,
          message: from === "INCOMPLETE" ? "Compléments transmis par l'apprenant" : "Dossier déposé par l'apprenant",
        },
      },
    },
  });
  await audit("application.submit", { actorId: user.id, organizationId: app.course.organizationId, entityType: "Application", entityId: app.id, details: { number: app.number } });
  await notifyOrgManagers(
    app.course.organizationId,
    from === "INCOMPLETE" ? `Compléments reçus – ${app.number}` : `Nouveau dossier à vérifier – ${app.number}`,
    `${user.name} · ${app.course.title}`,
    `/of/applications/${app.id}`,
  );
  await notify(user.id, "Dossier déposé", `Votre dossier ${app.number} a bien été transmis à l'organisme de formation.`, `/applications/${app.id}`);
  revalidateApp(applicationId);
  return { ok: "Dossier déposé ! L'organisme de formation va le vérifier." };
}

export async function withdrawApplicationAction(applicationId: string) {
  const user = await requireUser();
  const app = await loadOwnApp(applicationId, user);
  if (["ENROLLED", "REJECTED", "WITHDRAWN"].includes(app.status)) throw new Error("Action impossible");
  await db.application.update({
    where: { id: applicationId },
    data: {
      status: "WITHDRAWN",
      events: { create: { type: "STATUS", fromStatus: app.status, toStatus: "WITHDRAWN", authorId: user.id, message: "Dossier retiré par l'apprenant" } },
    },
  });
  await audit("application.status", { actorId: user.id, organizationId: app.course.organizationId, entityType: "Application", entityId: app.id, details: { to: "WITHDRAWN" } });
  if (app.status !== "DRAFT") await notifyOrgManagers(app.course.organizationId, `Dossier retiré – ${app.number}`, user.name, `/of/applications/${app.id}`);
  revalidateApp(applicationId);
}

/** Message dans le fil du dossier (apprenant ou OF ; note interne réservée à l'OF). */
export async function sendApplicationMessageAction(applicationId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const app = await loadApp(applicationId);
  const staff = canManageOrg(user, app.course.organizationId);
  if (!staff && app.userId !== user.id) return { error: "Accès refusé." };
  const message = str(fd, "message");
  if (!message) return { error: "Message vide." };
  const recent = await db.applicationEvent.count({ where: { authorId: user.id, type: { in: ["MESSAGE", "NOTE"] }, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
  if (recent >= 30) return { error: "Trop de messages envoyés : réessayez dans quelques minutes." };
  const internal = staff && bool(fd, "internal");
  await db.applicationEvent.create({ data: { applicationId, type: internal ? "NOTE" : "MESSAGE", authorId: user.id, message: message.slice(0, 5000) } });
  if (!internal) {
    if (staff) await notify(app.userId, `Nouveau message sur votre dossier ${app.number}`, message.slice(0, 140), `/applications/${app.id}`);
    else await notifyOrgManagers(app.course.organizationId, `Message de l'apprenant – ${app.number}`, message.slice(0, 140), `/of/applications/${app.id}`);
  }
  await audit("application.message", { actorId: user.id, organizationId: app.course.organizationId, entityType: "Application", entityId: app.id, details: { internal } });
  revalidateApp(applicationId);
  return { ok: internal ? "Note interne ajoutée." : "Message envoyé." };
}

// ═══════════════════════════════ Organisme de formation ═══════════════════════════════

export async function setApplicationStatusAction(applicationId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const app = await loadStaffApp(applicationId, user);
  const to = str(fd, "status") as ApplicationStatus;
  if (!STAFF_TRANSITIONS[app.status]?.includes(to)) {
    return { error: `Transition impossible : ${APPLICATION_STATUS[app.status].label} → ${APPLICATION_STATUS[to]?.label ?? to}` };
  }
  const message = str(fd, "message");
  if ((to === "INCOMPLETE" || to === "REJECTED") && message.length < 5) {
    return { error: to === "INCOMPLETE" ? "Précisez les compléments attendus." : "Motivez la décision de refus." };
  }
  if (to === "ACCEPTED") {
    const pendingDocs = await db.applicationDocument.count({ where: { applicationId, status: { not: "VALIDATED" } } });
    if (pendingDocs > 0 && !bool(fd, "force")) {
      return { error: `${pendingDocs} justificatif(s) non validé(s). Validez-les ou cochez « valider malgré tout ».` };
    }
  }
  await db.application.update({
    where: { id: applicationId },
    data: {
      status: to,
      reviewedAt: new Date(),
      reviewedById: user.id,
      decisionReason: to === "REJECTED" ? message : app.decisionReason,
      events: { create: { type: "STATUS", fromStatus: app.status, toStatus: to, authorId: user.id, message: message || null } },
    },
  });
  const titles: Partial<Record<ApplicationStatus, string>> = {
    UNDER_REVIEW: "Votre dossier est en cours d'instruction",
    INCOMPLETE: "Des compléments sont demandés sur votre dossier",
    ACCEPTED: "Votre dossier est validé",
    REJECTED: "Décision sur votre dossier",
  };
  await notify(app.userId, `${titles[to] ?? "Mise à jour de votre dossier"} (${app.number})`, message || null, `/applications/${app.id}`);
  await audit("application.status", {
    actorId: user.id,
    organizationId: app.course.organizationId,
    entityType: "Application",
    entityId: app.id,
    details: { from: app.status, to, message },
  });
  revalidateApp(applicationId);
  return { ok: `Statut mis à jour : ${APPLICATION_STATUS[to].label}` };
}

export async function reviewDocumentAction(documentId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const doc = await db.applicationDocument.findUnique({
    where: { id: documentId },
    include: { application: { include: { course: { select: { organizationId: true } } } } },
  });
  if (!doc || !canManageOrg(user, doc.application.course.organizationId)) return { error: "Accès refusé." };
  const status = str(fd, "status") as "VALIDATED" | "REJECTED" | "PENDING";
  if (!["VALIDATED", "REJECTED", "PENDING"].includes(status)) return { error: "Statut invalide." };
  const comment = optStr(fd, "comment");
  if (status === "REJECTED" && !comment) return { error: "Indiquez le motif du refus du justificatif." };
  await db.applicationDocument.update({
    where: { id: documentId },
    data: { status, comment, reviewedAt: new Date(), reviewedById: user.id },
  });
  const label = DOCUMENT_TYPES[doc.type]?.label ?? doc.type;
  await db.applicationEvent.create({
    data: {
      applicationId: doc.applicationId,
      type: "DOCUMENT",
      authorId: user.id,
      message: `${label} : ${status === "VALIDATED" ? "validé" : status === "REJECTED" ? `refusé – ${comment}` : "remis en attente"}`,
    },
  });
  if (status === "REJECTED") {
    await notify(doc.application.userId, `Justificatif à remplacer : ${label}`, comment, `/applications/${doc.applicationId}`);
  }
  await audit("application.document.review", {
    actorId: user.id,
    organizationId: doc.application.course.organizationId,
    entityType: "ApplicationDocument",
    entityId: doc.id,
    details: { status, comment, type: doc.type },
  });
  revalidateApp(doc.applicationId);
  return { ok: "Justificatif mis à jour." };
}

/** Inscription définitive : crée l'inscription à la formation à partir du dossier validé. */
export async function enrollFromApplicationAction(applicationId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const app = await loadStaffApp(applicationId, user);
  if (app.status !== "ACCEPTED") return { error: "Le dossier doit d'abord être validé." };
  const startDate = dateOrNull(str(fd, "startDate"));
  const endDate = dateOrNull(str(fd, "endDate"));
  if (!startDate || !endDate) return { error: "Dates de début et de fin obligatoires." };
  if (endDate < startDate) return { error: "La date de fin doit être postérieure à la date de début." };
  const plannedHours = optFloat(fd, "plannedHours");
  if (!plannedHours || plannedHours <= 0) return { error: "Durée prévue (heures) obligatoire." };
  const fundingType = (str(fd, "fundingType") || app.fundingType) as FundingType | null;
  const sessionId = optStr(fd, "sessionId") ?? app.sessionId;
  if (sessionId) {
    const s = await db.trainingSession.findUnique({ where: { id: sessionId }, select: { courseId: true, capacity: true, _count: { select: { enrollments: true } } } });
    if (!s || s.courseId !== app.courseId) return { error: "Session invalide." };
    if (s.capacity && s._count.enrollments >= s.capacity && !bool(fd, "overbook")) {
      return { error: "Session complète. Cochez « dépasser la capacité » pour forcer l'inscription." };
    }
  }
  const data = {
    status: "ACTIVE" as const,
    applicationId: app.id,
    sessionId,
    fundingType,
    fundingReference: optStr(fd, "fundingReference") ?? app.fundingReference,
    startDate,
    endDate,
    plannedHours,
    enrolledById: user.id,
  };
  const org = await db.organization.findUniqueOrThrow({ where: { id: app.course.organizationId }, select: { enrollmentRequiredDocuments: true } });
  const previous = await db.enrollment.findUnique({ where: { userId_courseId: { userId: app.userId, courseId: app.courseId } }, select: { id: true } });
  const enrollment = await db.enrollment.upsert({
    where: { userId_courseId: { userId: app.userId, courseId: app.courseId } },
    create: { userId: app.userId, courseId: app.courseId, ...data, origin: "APPLICATION", accessStatus: initialAccessStatus(org, "APPLICATION") },
    update: data,
  });
  await db.application.update({
    where: { id: app.id },
    data: {
      status: "ENROLLED",
      events: {
        create: {
          type: "STATUS",
          fromStatus: "ACCEPTED",
          toStatus: "ENROLLED",
          authorId: user.id,
          message: `Inscription définitive du ${startDate.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} au ${endDate.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} (${plannedHours} h)`,
        },
      },
    },
  });
  const learner = await db.user.findUnique({ where: { id: app.userId }, select: { organizationId: true } });
  if (!learner?.organizationId) await db.user.update({ where: { id: app.userId }, data: { organizationId: app.course.organizationId } });
  if (!previous) await announceEnrollment(enrollment, app.course);
  await audit("enrollment.create", {
    actorId: user.id,
    organizationId: app.course.organizationId,
    entityType: "Enrollment",
    entityId: enrollment.id,
    details: { application: app.number, startDate, endDate, plannedHours, fundingType },
  });
  revalidateApp(applicationId);
  return { ok: "Apprenant inscrit définitivement à la formation." };
}
