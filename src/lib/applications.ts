import "server-only";
import type { ApplicationStatus, FundingType, LearnerProfile } from "@prisma/client";
import { db } from "./db";
import { DOCUMENT_TYPES } from "./labels";

/** Statuts dans lesquels l'apprenant peut encore modifier son dossier. */
export const EDITABLE_STATUSES: ApplicationStatus[] = ["DRAFT", "INCOMPLETE"];
/** Statuts « en cours » (un seul dossier actif par formation). */
export const ACTIVE_STATUSES: ApplicationStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "INCOMPLETE", "ACCEPTED", "ENROLLED"];

/** Transitions autorisées pour l'OF. */
export const STAFF_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: [],
  SUBMITTED: ["UNDER_REVIEW", "INCOMPLETE", "ACCEPTED", "REJECTED"],
  UNDER_REVIEW: ["INCOMPLETE", "ACCEPTED", "REJECTED"],
  INCOMPLETE: ["UNDER_REVIEW", "REJECTED"],
  ACCEPTED: ["UNDER_REVIEW", "REJECTED"],
  ENROLLED: [],
  REJECTED: ["UNDER_REVIEW"],
  WITHDRAWN: [],
};

/** Justificatifs complémentaires exigés selon le mode de financement. */
const FUNDING_DOCUMENTS: Partial<Record<FundingType, string[]>> = {
  CPF: ["CPF_PROOF"],
  FRANCE_TRAVAIL: ["FT_ATTESTATION"],
  OPCO: ["EMPLOYER_AGREEMENT"],
  EMPLOYER: ["EMPLOYER_AGREEMENT"],
};

/** Liste des justificatifs obligatoires pour un dossier (formation > OF > financement). */
export function requiredDocumentsFor(
  course: { requiredDocuments: string[]; organization: { requiredDocuments: string[] } },
  fundingType: FundingType | null | undefined,
) {
  const base = course.requiredDocuments.length ? course.requiredDocuments : course.organization.requiredDocuments;
  const extra = fundingType ? FUNDING_DOCUMENTS[fundingType] ?? [] : [];
  return Array.from(new Set([...base, ...extra])).filter((c) => c in DOCUMENT_TYPES);
}

const PROFILE_REQUIRED: [keyof LearnerProfile, string][] = [
  ["civility", "Civilité"],
  ["firstName", "Prénom"],
  ["lastName", "Nom"],
  ["birthDate", "Date de naissance"],
  ["birthPlace", "Lieu de naissance"],
  ["nationality", "Nationalité"],
  ["phone", "Téléphone"],
  ["address", "Adresse"],
  ["postalCode", "Code postal"],
  ["city", "Ville"],
  ["employmentStatus", "Situation professionnelle"],
  ["educationLevel", "Niveau de formation"],
];

/** Champs manquants du profil administratif, avec règles conditionnelles selon la situation et le financement. */
export function missingProfileFields(profile: LearnerProfile | null, fundingType?: FundingType | null) {
  const missing: string[] = [];
  for (const [key, label] of PROFILE_REQUIRED) {
    const v = profile?.[key];
    if (v === null || v === undefined || v === "") missing.push(label);
  }
  if (profile?.employmentStatus === "JOB_SEEKER" && !profile.franceTravailId) missing.push("Identifiant France Travail");
  if (fundingType === "FRANCE_TRAVAIL" && !profile?.franceTravailId && !missing.includes("Identifiant France Travail")) {
    missing.push("Identifiant France Travail");
  }
  if ((fundingType === "OPCO" || fundingType === "EMPLOYER") && !profile?.employerName) missing.push("Employeur (raison sociale)");
  if ((fundingType === "OPCO" || fundingType === "EMPLOYER") && !profile?.employerSiret) missing.push("SIRET de l'employeur");
  if (fundingType === "OPCO" && !profile?.opcoName) missing.push("Nom de l'OPCO");
  if (profile?.disability && !profile.disabilityNeeds) missing.push("Besoins d'aménagement (handicap)");
  return missing;
}

/** Vérifie qu'un dossier peut être déposé ; renvoie la liste des blocages. */
export async function applicationBlockers(applicationId: string) {
  const app = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      documents: true,
            course: { select: { skills: true, requiredDocuments: true, organization: { select: { requiredDocuments: true } }, sessions: { where: { open: true }, select: { id: true } } } },
      user: { select: { profile: true } },
    },
  });
  const blockers: string[] = [];
  const missing = missingProfileFields(app.user.profile, app.fundingType);
  if (missing.length) blockers.push(`Profil administratif incomplet : ${missing.join(", ")}`);
  if (!app.fundingType) blockers.push("Mode de financement non renseigné");
  if (app.fundingType === "CPF" && !app.fundingReference) blockers.push("Numéro de dossier CPF non renseigné");
  if (!app.motivation || app.motivation.trim().length < 30) blockers.push("Motivation à détailler (30 caractères minimum)");
  if (!app.prerequisitesOk) blockers.push("Attestation du respect des prérequis non cochée");
    if (app.course.sessions.length > 0 && !app.sessionId) blockers.push("Session de formation non choisie");
  const pos = (app.positioning ?? {}) as Record<string, number>;
  const missingSkills = app.course.skills.filter((s) => pos[s] === undefined);
  if (missingSkills.length) blockers.push(`Positionnement incomplet (${missingSkills.length} compétence(s) à évaluer)`);
  const required = requiredDocumentsFor(app.course, app.fundingType);
  for (const code of required) {
    const docs = app.documents.filter((d) => d.type === code && d.status !== "REJECTED");
    if (!docs.length) blockers.push(`Justificatif manquant : ${DOCUMENT_TYPES[code]?.label ?? code}`);
  }
  if (app.user.profile?.disability) {
    // RQTH facultatif mais conseillé : pas bloquant
  }
  return { blockers, required };
}

export async function nextApplicationNumber() {
  const year = new Date().getFullYear();
  const count = await db.application.count({ where: { number: { startsWith: `DOS-${year}-` } } });
  for (let i = 1; i < 50; i++) {
    const candidate = `DOS-${year}-${String(count + i).padStart(5, "0")}`;
    const exists = await db.application.findUnique({ where: { number: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `DOS-${year}-${Date.now()}`;
}

export const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
