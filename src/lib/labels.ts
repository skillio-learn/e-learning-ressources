// Libellés métier (candidatures, financements, justificatifs…)

export const APPLICATION_STATUS = {
  DRAFT: { label: "Brouillon", tone: "gray" },
  SUBMITTED: { label: "Déposé – à vérifier", tone: "blue" },
  UNDER_REVIEW: { label: "En cours d'instruction", tone: "purple" },
  INCOMPLETE: { label: "Compléments demandés", tone: "amber" },
  ACCEPTED: { label: "Validé – inscription à finaliser", tone: "green" },
  ENROLLED: { label: "Inscrit définitivement", tone: "green" },
  REJECTED: { label: "Refusé", tone: "red" },
  WITHDRAWN: { label: "Retiré par l'apprenant", tone: "gray" },
} as const;

export type AppStatus = keyof typeof APPLICATION_STATUS;

export const FUNDING_TYPES = {
  CPF: "CPF (Mon Compte Formation)",
  OPCO: "OPCO (prise en charge employeur)",
  FRANCE_TRAVAIL: "France Travail (AIF / financement demandeur d'emploi)",
  EMPLOYER: "Employeur (plan de développement des compétences)",
  REGION: "Région / collectivité",
  PERSONAL: "Financement personnel",
  OTHER: "Autre",
} as const;

export const EMPLOYMENT_STATUS = {
  JOB_SEEKER: "Demandeur d'emploi",
  EMPLOYEE: "Salarié(e)",
  SELF_EMPLOYED: "Indépendant(e) / chef d'entreprise",
  STUDENT: "Étudiant(e)",
  CIVIL_SERVANT: "Agent de la fonction publique",
  OTHER: "Autre",
} as const;

export const EDUCATION_LEVELS = [
  "Niveau 3 (CAP, BEP)",
  "Niveau 4 (Baccalauréat)",
  "Niveau 5 (Bac+2 : BTS, DUT)",
  "Niveau 6 (Bac+3 : Licence, BUT)",
  "Niveau 7 (Bac+5 : Master)",
  "Niveau 8 (Doctorat)",
  "Sans diplôme",
];

export const DOCUMENT_TYPES: Record<string, { label: string; hint?: string }> = {
  ID: { label: "Pièce d'identité", hint: "Carte d'identité recto/verso, passeport ou titre de séjour en cours de validité" },
  CV: { label: "Curriculum vitae" },
  PROOF_ADDRESS: { label: "Justificatif de domicile", hint: "De moins de 3 mois" },
  FT_ATTESTATION: { label: "Attestation d'inscription France Travail", hint: "Avec votre identifiant France Travail" },
  VITALE: { label: "Attestation de sécurité sociale / carte Vitale" },
  DIPLOMA: { label: "Dernier diplôme obtenu" },
  CPF_PROOF: { label: "Récapitulatif de commande CPF", hint: "Capture ou PDF de votre dossier Mon Compte Formation" },
  EMPLOYER_AGREEMENT: { label: "Accord de prise en charge employeur / OPCO" },
  QUOTE_SIGNED: { label: "Devis ou convention de formation signé(e)" },
  RQTH: { label: "Justificatif RQTH / situation de handicap", hint: "Uniquement si vous souhaitez un aménagement" },
  PHOTO: { label: "Photo d'identité" },
  OTHER: { label: "Autre document" },
};

export const MODALITY_LABELS = { FOAD: "À distance (FOAD)", PRESENTIEL: "Présentiel", MIXTE: "Mixte (blended)" } as const;

export const COMPLAINT_STATUS = {
  OPEN: { label: "Ouverte", tone: "amber" },
  IN_PROGRESS: { label: "En cours de traitement", tone: "blue" },
  RESOLVED: { label: "Résolue", tone: "green" },
} as const;

export const COMPLAINT_CATEGORIES = [
  "Réclamation",
  "Question pédagogique",
  "Problème technique",
  "Question administrative / financement",
  "Accessibilité / handicap",
  "Autre",
];

export const SATISFACTION_QUESTIONS = [
  { code: "objectives", label: "Les objectifs de la formation ont été atteints" },
  { code: "content", label: "Qualité des contenus pédagogiques" },
  { code: "platform", label: "Facilité d'utilisation de la plateforme" },
  { code: "support", label: "Qualité de l'accompagnement (formateur, OF)" },
  { code: "organization", label: "Organisation et informations reçues" },
  { code: "useful", label: "Utilité pour votre projet professionnel" },
];

export function formatDuration(totalSec: number | null | undefined) {
  const s = Math.max(0, Math.round(totalSec ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return `${m} min ${String(sec).padStart(2, "0")} s`;
  return `${sec} s`;
}

export function formatHours(totalSec: number | null | undefined) {
  return `${(Math.round(((totalSec ?? 0) / 3600) * 100) / 100).toLocaleString("fr-FR")} h`;
}

export const ENROLLMENT_STATUS = {
  ACTIVE: { label: "En cours", tone: "blue" },
  COMPLETED: { label: "Terminée", tone: "green" },
  SUSPENDED: { label: "Interrompue", tone: "amber" },
  ABANDONED: { label: "Abandon", tone: "red" },
} as const;

/** Motifs de sortie anticipée (demandés par les OPCO / France Travail / CDC). */
export const EXIT_REASONS: Record<string, string> = {
  LEARNER_CHOICE: "Abandon à l'initiative du stagiaire",
  EMPLOYMENT: "Reprise d'emploi / entrée en contrat",
  HEALTH: "Raison médicale",
  FAMILY: "Raison familiale ou personnelle",
  FORCE_MAJEURE: "Cas de force majeure",
  OTHER_TRAINING: "Entrée dans une autre formation",
  EXCLUSION: "Exclusion (règlement intérieur)",
  NO_SHOW: "Absence de connexion / non-démarrage",
  OTHER: "Autre motif",
};

export const SKILL_LEVELS = ["Aucune notion", "Débutant", "Intermédiaire", "Confirmé", "Expert"];

export const FUNDER_QUESTIONS = [
  { code: "relevance", label: "Adéquation de la formation aux besoins" },
  { code: "information", label: "Qualité de l'information et des échanges avec l'organisme" },
  { code: "followup", label: "Suivi administratif (dossier, attestations, justificatifs)" },
  { code: "results", label: "Résultats observés / montée en compétences" },
  { code: "recommend", label: "Recommanderiez-vous cet organisme ?" },
];

export const RESPONDENT_TYPES: Record<string, string> = {
  EMPLOYER: "Entreprise / employeur",
  OPCO: "OPCO",
  FRANCE_TRAVAIL: "France Travail",
  OTHER: "Autre financeur / partenaire",
};

// ─────────────── Lot 3 : comptes, accès aux parcours, assistance ───────────────

export const ACCOUNT_STATUS = {
  PENDING_PROFILE: { label: "Informations à compléter", tone: "amber" },
  PENDING_REVIEW: { label: "En attente de validation", tone: "blue" },
  ACTIVE: { label: "Compte validé", tone: "green" },
  REJECTED: { label: "Inscription refusée", tone: "red" },
} as const;

export const ACCESS_STATUS = {
  PENDING_DOCUMENTS: { label: "Documents à fournir", tone: "amber" },
  UNDER_REVIEW: { label: "En cours de validation", tone: "blue" },
  GRANTED: { label: "Accès ouvert", tone: "green" },
  REFUSED: { label: "Accès refusé", tone: "red" },
} as const;

/** Pièces possibles au niveau du compte (codes partagés avec DOCUMENT_TYPES). */
export const ACCOUNT_DOCUMENT_CHOICES = ["ID", "PROOF_ADDRESS", "VITALE", "PHOTO", "CV", "DIPLOMA", "RQTH"] as const;

/** Documents d'inscription à un parcours. `esign` : peut être signé en ligne sur la plateforme. */
export const ENROLLMENT_DOCUMENTS: Record<string, { label: string; hint: string; esign: "convention" | "text" | null }> = {
  CONVENTION: { label: "Convention / contrat de formation signé(e)", hint: "Signez en ligne ou déposez la version signée.", esign: "convention" },
  CGV: { label: "Conditions générales de vente signées", hint: "Lisez et signez les CGV de l'organisme.", esign: "text" },
  INTERNAL_RULES: { label: "Règlement intérieur signé", hint: "Lisez et signez le règlement intérieur de l'organisme.", esign: "text" },
  FUNDING_AGREEMENT: { label: "Accord de prise en charge (financeur)", hint: "OPCO, France Travail, employeur, CPF…", esign: null },
  IMAGE_RIGHTS: { label: "Autorisation de droit à l'image", hint: "Si des captations sont prévues pendant la formation.", esign: null },
  IT_CHARTER: { label: "Charte d'utilisation de la plateforme", hint: "Charte informatique signée.", esign: null },
};

export const DOC_SOURCE = { LEARNER_UPLOAD: "Déposé par l'apprenant", STAFF_UPLOAD: "Déposé par l'organisme", E_SIGNATURE: "Signé en ligne" } as const;

export const SUPPORT_CATEGORIES: Record<string, string> = {
  ACCOUNT: "Mon compte / inscription",
  ENROLLMENT: "Accès à une formation",
  TECH: "Problème technique",
  PEDAGOGY: "Question pédagogique",
  FUNDING: "Financement",
  OTHER: "Autre",
};

export const SUPPORT_STATUS = {
  OPEN: { label: "En attente de réponse", tone: "amber" },
  WAITING: { label: "Répondu", tone: "blue" },
  RESOLVED: { label: "Résolu", tone: "green" },
} as const;

// ─────────────── Support Vylia : tickets OF ↔ administrateur ───────────────

export const TICKET_CATEGORIES: Record<string, string> = {
  ORG_INFO: "Modification des informations de l'organisme",
  TECH: "Incident technique",
  BUG: "Anomalie / comportement inattendu",
  ACCOUNT: "Comptes, accès & équipe",
  BILLING: "Abonnement & facturation",
  COMPLIANCE: "Qualiopi, financeurs & conformité",
  FEATURE: "Demande d'évolution",
  OTHER: "Autre demande",
};

export const TICKET_PRIORITY = {
  LOW: { label: "Basse", tone: "gray", slaHours: 72, hint: "Question sans urgence" },
  NORMAL: { label: "Normale", tone: "blue", slaHours: 24, hint: "Gêne ponctuelle, contournement possible" },
  HIGH: { label: "Haute", tone: "amber", slaHours: 8, hint: "Fonction importante indisponible" },
  URGENT: { label: "Urgente", tone: "red", slaHours: 4, hint: "Service bloqué pour l'organisme ou ses apprenants" },
} as const;

export const TICKET_STATUS = {
  OPEN: { label: "Nouveau", ofLabel: "Envoyé", tone: "amber" },
  IN_PROGRESS: { label: "En cours", ofLabel: "Pris en charge", tone: "blue" },
  WAITING_OF: { label: "En attente de l'OF", ofLabel: "Réponse reçue", tone: "purple" },
  RESOLVED: { label: "Résolu", ofLabel: "Résolu, à confirmer", tone: "green" },
  CLOSED: { label: "Clôturé", ofLabel: "Clôturé", tone: "gray" },
} as const;

/**
 * Informations d'identité de l'organisme : une fois renseignées par l'OF, elles ne sont plus modifiables
 * que par le support Vylia (demande par ticket, catégorie ORG_INFO).
 */
export const LOCKED_ORG_FIELDS = {
  name: "Nom commercial",
  legalName: "Raison sociale",
  siret: "SIRET",
  nda: "N° de déclaration d'activité",
  ndaRegion: "Région / préfecture du NDA",
  qualiopiNumber: "N° de certificat Qualiopi",
  qualiopiDate: "Date de certification Qualiopi",
  logoUrl: "Logo",
  address: "Adresse",
  postalCode: "Code postal",
  city: "Ville",
  phone: "Téléphone",
  email: "Email de contact",
  website: "Site web",
  managerName: "Nom du signataire",
  managerTitle: "Fonction du signataire",
  internalRulesUrl: "Règlement intérieur (URL)",
  cgvUrl: "CGV (URL)",
  referentHandicap: "Référent handicap",
  mediatorInfo: "Médiateur de la consommation",
} as const;
export type LockedOrgField = keyof typeof LOCKED_ORG_FIELDS;

export const isOrgFieldFilled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";
