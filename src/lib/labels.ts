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
