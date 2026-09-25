import "server-only";
import { createHash, randomBytes } from "crypto";
import type { AccessStatus, Enrollment, Organization } from "@prisma/client";
import { db } from "./db";
import { missingProfileFields } from "./applications";
import { DOCUMENT_TYPES, ENROLLMENT_DOCUMENTS } from "./labels";
import { notify, notifyOrgManagers } from "./notify";
import { audit } from "./audit";

// ─────────────── Compte apprenant ───────────────

/** Pages accessibles à un apprenant dont le compte n'est pas encore validé. */
export const PENDING_ACCOUNT_ALLOWED = [
  "/onboarding",
  "/profile",
  "/support",
  "/notifications",
  "/legal",
  "/api/support",
  "/api/learner-documents",
  "/api/me",
  "/api/activity",
  "/api/notifications",
];

export function isAllowedWhilePending(pathname: string | null) {
  if (!pathname) return true; // contexte inconnu (tâche interne) : la vérification se fait ailleurs
  return PENDING_ACCOUNT_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

type OrgDocs = Pick<Organization, "accountRequiredDocuments" | "requireAccountValidation"> | null;

/** Pièces demandées pour valider un compte (paramètre de l'OF ; pièce d'identité par défaut si aucun OF). */
export function accountRequiredDocs(org: OrgDocs) {
  const list = org ? org.accountRequiredDocuments : ["ID"];
  return list.filter((c) => c in DOCUMENT_TYPES);
}

/** État du dossier de compte : champs manquants, pièces manquantes / refusées / en attente. */
export async function accountChecklist(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      profile: true,
      organization: { select: { id: true, name: true, accountRequiredDocuments: true, requireAccountValidation: true } },
      learnerDocuments: { where: { enrollmentId: null }, orderBy: { createdAt: "desc" } },
    },
  });
  const missingFields = missingProfileFields(user.profile, null);
  const required = accountRequiredDocs(user.organization);
  const docs = required.map((type) => {
    const files = user.learnerDocuments.filter((d) => d.type === type);
    const live = files.filter((d) => d.status !== "REJECTED");
    const state = live.some((d) => d.status === "VALIDATED")
      ? ("VALIDATED" as const)
      : live.length
        ? ("PENDING" as const)
        : files.length
          ? ("REJECTED" as const)
          : ("MISSING" as const);
    return { type, label: DOCUMENT_TYPES[type].label, hint: DOCUMENT_TYPES[type].hint, files, state };
  });
  const blockers = [
    ...(missingFields.length ? [`Informations manquantes : ${missingFields.join(", ")}`] : []),
    ...docs.filter((d) => d.state === "MISSING" || d.state === "REJECTED").map((d) => `Pièce à fournir : ${d.label}`),
  ];
  return { user, missingFields, docs, blockers, extraDocs: user.learnerDocuments.filter((d) => !required.includes(d.type)) };
}

/** Lien d'activation (définition du mot de passe) pour un compte créé par l'OF — valable 7 jours. */
export async function createActivationLink(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.passwordResetToken.create({
    data: { userId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 7 * 24 * 3600_000) },
  });
  return `/reset-password/${token}`;
}

// ─────────────── Accès aux parcours ───────────────

type OrgAccess = Pick<Organization, "enrollmentRequiredDocuments" | "autoGrantAccess" | "cgvText" | "cgvUrl" | "internalRulesText" | "internalRulesUrl">;

export function enrollmentRequiredDocs(org: Pick<Organization, "enrollmentRequiredDocuments">) {
  return org.enrollmentRequiredDocuments.filter((c) => c in ENROLLMENT_DOCUMENTS);
}

/** Signature en ligne possible pour ce type de document avec les paramètres de l'OF ? */
export function canESign(type: string, org: Pick<OrgAccess, "cgvText" | "internalRulesText">) {
  const def = ENROLLMENT_DOCUMENTS[type];
  if (!def?.esign) return false;
  if (def.esign === "convention") return true;
  if (type === "CGV") return !!org.cgvText?.trim();
  if (type === "INTERNAL_RULES") return !!org.internalRulesText?.trim();
  return false;
}

export function signedText(type: string, org: Pick<OrgAccess, "cgvText" | "internalRulesText">) {
  if (type === "CGV") return org.cgvText ?? "";
  if (type === "INTERNAL_RULES") return org.internalRulesText ?? "";
  return "";
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** État détaillé du dossier d'accès d'une inscription. */
export async function accessChecklist(enrollmentId: string) {
  const e = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: {
      user: { select: { id: true, name: true, email: true, accountStatus: true } },
      course: { select: { id: true, title: true, slug: true, organizationId: true, organization: true } },
      documents: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } }, reviewedBy: { select: { name: true } } } },
      accessDecidedBy: { select: { name: true } },
    },
  });
  const org = e.course.organization;
  const required = enrollmentRequiredDocs(org);
  const items = required.map((type) => {
    const files = e.documents.filter((d) => d.type === type);
    const live = files.filter((d) => d.status !== "REJECTED");
    const state = live.some((d) => d.status === "VALIDATED")
      ? ("VALIDATED" as const)
      : live.length
        ? ("PENDING" as const)
        : files.length
          ? ("REJECTED" as const)
          : ("MISSING" as const);
    return { type, ...ENROLLMENT_DOCUMENTS[type], files, state, esignable: canESign(type, org) };
  });
  const allProvided = items.every((i) => i.state === "PENDING" || i.state === "VALIDATED");
  const allValidated = items.every((i) => i.state === "VALIDATED");
  return { enrollment: e, org, items, allProvided, allValidated, extraDocs: e.documents.filter((d) => !required.includes(d.type)) };
}

/**
 * Recalcule le statut d'accès après un dépôt, une signature ou une revue.
 * - Tant que des pièces manquent : PENDING_DOCUMENTS.
 * - Toutes fournies : UNDER_REVIEW (l'OF est notifié une fois).
 * - Toutes validées + ouverture automatique activée + compte validé : GRANTED.
 * Une décision explicite (accès ouvert ou refusé) n'est jamais modifiée automatiquement.
 */
export async function refreshAccessStatus(enrollmentId: string, actorId?: string | null) {
  const { enrollment: e, org, allProvided, allValidated } = await accessChecklist(enrollmentId);
  if (e.accessStatus === "GRANTED" || e.accessStatus === "REFUSED") return e.accessStatus;
  let next: AccessStatus = allProvided ? "UNDER_REVIEW" : "PENDING_DOCUMENTS";
  if (allValidated && org.autoGrantAccess && e.user.accountStatus === "ACTIVE") next = "GRANTED";
  if (next === e.accessStatus) return next;
  await db.enrollment.update({
    where: { id: e.id },
    data: {
      accessStatus: next,
      ...(next === "UNDER_REVIEW" ? { accessSubmittedAt: new Date() } : {}),
      ...(next === "GRANTED" ? { accessDecidedAt: new Date(), accessDecidedById: null, accessDecisionNote: "Ouverture automatique : toutes les pièces sont validées." } : {}),
    },
  });
  if (next === "UNDER_REVIEW") {
    await notifyOrgManagers(
      e.course.organizationId,
      `Dossier d'accès complet – ${e.user.name}`,
      `Toutes les pièces d'inscription à « ${e.course.title} » ont été fournies : vérifiez-les et ouvrez l'accès.`,
      `/of/access/${e.id}`,
    );
    await audit("access.submit", { actorId, organizationId: e.course.organizationId, entityType: "Enrollment", entityId: e.id });
  }
  if (next === "GRANTED") {
    await notify(e.user.id, `Accès ouvert : ${e.course.title}`, "Votre inscription est complète, vous pouvez commencer la formation.", `/learn/${e.course.slug}`);
    await audit("access.grant", { actorId, organizationId: e.course.organizationId, entityType: "Enrollment", entityId: e.id, details: "automatique" });
  }
  return next;
}

/**
 * Statut d'accès initial d'une nouvelle inscription.
 * - Inscrit par l'OF sans pièce exigée : accès ouvert.
 * - Demande de l'apprenant sans pièce exigée : validation de l'OF requise.
 */
export function initialAccessStatus(org: Pick<Organization, "enrollmentRequiredDocuments">, origin: "OF" | "APPLICATION" | "SELF"): AccessStatus {
  const required = enrollmentRequiredDocs(org);
  if (required.length) return "PENDING_DOCUMENTS";
  return origin === "SELF" ? "UNDER_REVIEW" : "GRANTED";
}

/** Invite l'apprenant à compléter son dossier d'accès après la création d'une inscription. */
export async function announceEnrollment(e: Pick<Enrollment, "id" | "userId" | "accessStatus">, course: { title: string; slug: string }) {
  if (e.accessStatus === "GRANTED") {
    await notify(e.userId, `Inscription : ${course.title}`, "Votre accès à la formation est ouvert.", `/learn/${course.slug}`);
  } else {
    await notify(
      e.userId,
      `Finalisez votre inscription : ${course.title}`,
      "Signez ou déposez vos documents d'inscription (convention, CGV, règlement intérieur…) pour que l'organisme ouvre votre accès.",
      `/enrollments/${e.id}`,
    );
  }
}

/** L'apprenant peut-il suivre ce parcours ? */
export function learnerCanAccess(accountStatus: string, e: Pick<Enrollment, "accessStatus" | "status">) {
  return accountStatus === "ACTIVE" && e.accessStatus === "GRANTED" && e.status !== "SUSPENDED";
}
