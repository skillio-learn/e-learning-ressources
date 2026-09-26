/**
 * Référentiel national qualité (Qualiopi), en langage simple.
 * - Version "2019" : 32 indicateurs (décret 2019-564, guide de lecture V9 du 8 janvier 2024).
 * - Version "2026" : 33 indicateurs, décret n° 2026-728 du 1er août 2026, applicable aux audits réalisés
 *   à compter du 1er novembre 2026 (sans période transitoire). Les évolutions sont signalées par `changed2026`.
 * Le guide de lecture V10 et les arrêtés de seuils (indicateurs 19 et 20) étaient attendus à la date de rédaction :
 * les formulations restent à confirmer à leur publication.
 */

export type Scope = "ACTIONS" | "BILAN" | "VAE" | "APPRENTISSAGE";
/** ALL : tous · CERT : actions certifiantes (RNCP/RS) · ALT : alternance · CFA : apprentissage · ST : sous-traitance / portage */
export type Applicability = "ALL" | "CERT" | "ALT" | "CFA" | "ST";

export const SCOPE_LABELS: Record<Scope, string> = {
  ACTIONS: "Actions de formation",
  BILAN: "Bilans de compétences",
  VAE: "Validation des acquis de l'expérience",
  APPRENTISSAGE: "Actions de formation par apprentissage",
};

export const CRITERIA = [
  { n: 1, title: "Information du public", hint: "Ce que vous annoncez sur vos formations, vos résultats et vos certifications." },
  { n: 2, title: "Objectifs et adaptation des prestations", hint: "Analyse du besoin, objectifs, contenus et positionnement." },
  { n: 3, title: "Accueil, suivi et évaluation", hint: "Déroulement, accompagnement, prévention des abandons, évaluation des acquis." },
  { n: 4, title: "Moyens pédagogiques, techniques et d'encadrement", hint: "Locaux, plateforme, ressources, coordination des intervenants." },
  { n: 5, title: "Compétences des intervenants", hint: "Recrutement et développement des compétences des formateurs." },
  { n: 6, title: "Environnement professionnel", hint: "Veille, handicap, sous-traitance, partenaires." },
  { n: 7, title: "Appréciations et amélioration continue", hint: "Avis des parties prenantes, réclamations, actions d'amélioration." },
] as const;

export type Indicator = {
  code: string;
  criterion: number;
  title: string;
  expect: string; // Ce que l'auditeur attend, en langage simple
  proofs: string[]; // Preuves typiques
  applies: Applicability;
  newEntrant?: boolean; // Nouveaux entrants : seule la formalisation est vérifiée à l'audit initial
  changed2026?: string; // Évolution introduite par le décret 2026-728
  only2026?: boolean;
  pitfalls?: string; // Non-conformités fréquentes
  /** Où agir dans Vylia */
  links?: { label: string; href: string }[];
};

export const INDICATORS: Indicator[] = [
  // ── Critère 1
  {
    code: "1", criterion: 1, applies: "ALL",
    title: "Informer le public sur les prestations",
    expect: "Chaque formation est décrite de façon détaillée et vérifiable : prérequis, objectifs, durée, modalités et délais d'accès, tarifs, contacts, méthodes mobilisées, modalités d'évaluation et accessibilité aux personnes handicapées.",
    proofs: ["Fiches programmes publiées", "Catalogue ou site internet", "Fiches EDOF identiques au site"],
    changed2026: "Ajout du type de reconnaissance visée (certification, attestation…) et des modalités pédagogiques et de financement.",
    pitfalls: "Délai d'accès absent, tarif « sur devis » sans base, accessibilité non mentionnée, écarts entre le site et EDOF.",
    links: [{ label: "Formations", href: "/of/courses" }],
  },
  {
    code: "2", criterion: 1, applies: "ALL", newEntrant: true,
    title: "Publier des indicateurs de résultats",
    expect: "Des indicateurs de résultats adaptés à l'activité (satisfaction, réussite, abandon, insertion…) sont publiés, datés, avec l'effectif et la période concernés.",
    proofs: ["Page publique des résultats datée", "Effectif et période de calcul"],
    changed2026: "La méthode de calcul de chaque indicateur doit aussi être publiée.",
    pitfalls: "Taux non datés, sans effectif, jamais mis à jour.",
    links: [{ label: "Indicateurs de résultats", href: "/of/qualiopi/resultats" }],
  },
  {
    code: "3", criterion: 1, applies: "CERT", newEntrant: true,
    title: "Taux d'obtention des certifications",
    expect: "Pour les formations certifiantes : taux d'obtention, possibilités de valider des blocs, équivalences, passerelles, suites de parcours et débouchés.",
    proofs: ["Page certification avec le taux d'obtention", "Lien vers la fiche France compétences (RNCP / RS)"],
    changed2026: "Statut exact à confirmer par le guide de lecture V10.",
    links: [{ label: "Indicateurs de résultats", href: "/of/qualiopi/resultats" }],
  },
  // ── Critère 2
  {
    code: "4", criterion: 2, applies: "ALL",
    title: "Analyser le besoin du bénéficiaire",
    expect: "Le besoin de chaque bénéficiaire (et de l'entreprise ou du financeur le cas échéant) est analysé et tracé avant la formation.",
    proofs: ["Questionnaire ou entretien préalable", "Cahier des charges de l'entreprise (intra)", "Dossier de candidature"],
    pitfalls: "Analyse générique, non individualisée.",
    links: [{ label: "Dossiers de candidature", href: "/of/applications" }, { label: "Entreprises", href: "/of/companies" }],
  },
  {
    code: "5", criterion: 2, applies: "ALL",
    title: "Définir des objectifs opérationnels et évaluables",
    expect: "Les objectifs sont formulés en compétences observables et mesurables, adaptés au public.",
    proofs: ["Programmes avec objectifs rédigés en verbes d'action"],
    pitfalls: "Objectifs vagues (« sensibiliser », « découvrir »).",
    links: [{ label: "Formations", href: "/of/courses" }],
  },
  {
    code: "6", criterion: 2, applies: "ALL",
    title: "Adapter contenus et modalités aux objectifs",
    expect: "Les contenus, la durée, les modalités (présentiel, distance) et les méthodes sont cohérents avec les objectifs et le public.",
    proofs: ["Programme détaillé", "Déroulé pédagogique / scénario FOAD", "Parcours sur la plateforme"],
    links: [{ label: "Formations", href: "/of/courses" }],
  },
  {
    code: "7", criterion: 2, applies: "CERT",
    title: "Adéquation au référentiel de la certification",
    expect: "Les contenus couvrent les compétences du référentiel de la certification visée.",
    proofs: ["Tableau de correspondance avec les blocs RNCP / RS", "Habilitation ou convention avec le certificateur"],
    changed2026: "L'OF doit démontrer sa capacité réelle à préparer la certification (habilitation, convention avec le certificateur).",
    links: [{ label: "Formations", href: "/of/courses" }],
  },
  {
    code: "8", criterion: 2, applies: "ALL",
    title: "Positionner les bénéficiaires à l'entrée",
    expect: "Les acquis sont évalués à l'entrée (test, auto-positionnement, entretien) et le résultat est utilisé pour adapter le parcours.",
    proofs: ["Positionnement d'entrée", "Adaptations décidées"],
    pitfalls: "Positionnement réalisé mais jamais exploité.",
    links: [{ label: "Dossiers de candidature", href: "/of/applications" }],
  },
  // ── Critère 3
  {
    code: "9", criterion: 3, applies: "ALL",
    title: "Informer sur les conditions de déroulement",
    expect: "Le bénéficiaire reçoit avant l'entrée les informations pratiques : convocation, horaires, lieu ou accès à distance, contacts, règlement intérieur.",
    proofs: ["Convocations envoyées", "Règlement intérieur signé", "Livret d'accueil"],
    links: [{ label: "Paramètres de l'OF", href: "/of/settings" }],
  },
  {
    code: "10", criterion: 3, applies: "ALL",
    title: "Adapter, accompagner et suivre",
    expect: "L'OF suit chaque bénéficiaire, adapte la prestation si besoin et en garde la trace (FOAD : assistance technique et pédagogique).",
    proofs: ["Traçabilité des connexions et du temps", "Messagerie pédagogique", "Émargements"],
    links: [{ label: "Apprenants", href: "/of/learners" }],
  },
  {
    code: "11", criterion: 3, applies: "ALL", newEntrant: true,
    title: "Évaluer l'atteinte des objectifs",
    expect: "Des évaluations (formatives et finales) mesurent l'atteinte des objectifs par chaque bénéficiaire.",
    proofs: ["Quiz et devoirs corrigés", "Grilles d'évaluation", "Positionnement de sortie"],
    pitfalls: "Seul un questionnaire de satisfaction existe.",
    links: [{ label: "Résultats", href: "/of/courses" }],
  },
  {
    code: "12", criterion: 3, applies: "ALL",
    title: "Favoriser l'engagement et prévenir les ruptures",
    expect: "L'OF met en œuvre des mesures d'engagement et de prévention des abandons (relances, alertes d'assiduité, analyse des abandons).",
    proofs: ["Alertes de décrochage et relances", "Absences suivies", "Motifs d'abandon analysés"],
    changed2026: "Prévention et traitement des violences (dont sexistes et sexuelles), du harcèlement et des discriminations, avec une procédure de signalement formalisée.",
    links: [{ label: "Tableau de bord", href: "/of/home" }, { label: "Paramètres (règlement intérieur)", href: "/of/settings" }],
  },
  {
    code: "13", criterion: 3, applies: "ALT", newEntrant: true,
    title: "Coordination avec l'entreprise (alternance)",
    expect: "Pour l'alternance, les missions en entreprise sont anticipées et coordonnées avec le tuteur.",
    proofs: ["Livret d'alternance", "Comptes rendus de visites"],
  },
  {
    code: "14", criterion: 3, applies: "CFA", newEntrant: true,
    title: "Exercice de la citoyenneté (CFA)",
    expect: "Le CFA met en œuvre des actions favorisant l'exercice de la citoyenneté.",
    proofs: ["Actions menées"],
    changed2026: "Procédure de traitement immédiat des ruptures liées à des difficultés, violences ou discriminations, y compris en entreprise.",
  },
  {
    code: "15", criterion: 3, applies: "CFA",
    title: "Droits et devoirs de l'apprenti (CFA)",
    expect: "L'apprenti est informé de ses droits et devoirs et des règles de santé et sécurité.",
    proofs: ["Livret d'accueil", "Émargement de la séance d'information"],
    changed2026: "Information renforcée pour les mineurs et volet discriminations.",
  },
  {
    code: "16", criterion: 3, applies: "CERT",
    title: "Présentation à la certification",
    expect: "Les conditions de présentation à la certification sont respectées et les bénéficiaires informés.",
    proofs: ["Inscriptions aux examens", "Règlement de la certification"],
  },
  // ── Critère 4
  {
    code: "17", criterion: 4, applies: "ALL",
    title: "Moyens humains et techniques adaptés",
    expect: "Les moyens (locaux accessibles, équipements, plateforme, encadrement) sont adaptés aux prestations.",
    proofs: ["Plateforme de formation", "Description des locaux et de leur accessibilité", "Organigramme"],
  },
  {
    code: "18", criterion: 4, applies: "ALL",
    title: "Coordination des intervenants",
    expect: "La coordination des intervenants internes et externes est organisée.",
    proofs: ["Référents par formation", "Réunions pédagogiques et comptes rendus"],
    links: [{ label: "Équipe", href: "/of/team" }],
  },
  {
    code: "19", criterion: 4, applies: "ALL", newEntrant: true,
    title: "Ressources pédagogiques",
    expect: "Les ressources pédagogiques sont mises à disposition des bénéficiaires.",
    proofs: ["Ressources par module", "Accès à la plateforme"],
    changed2026: "Désignation d'un référent pédagogique par formation au-delà d'un seuil d'intervenants (seuil fixé par arrêté à paraître).",
    links: [{ label: "Formations", href: "/of/courses" }],
  },
  {
    code: "20", criterion: 4, applies: "CFA",
    title: "Personnels dédiés (CFA)",
    expect: "Le CFA dispose de personnels dédiés : référent handicap, mobilité, conseil de perfectionnement.",
    proofs: ["Nominations", "Procès-verbaux du conseil de perfectionnement"],
    changed2026: "Encadrement renforcé si la part d'intervenants permanents est sous un seuil fixé par arrêté.",
  },
  // ── Critère 5
  {
    code: "21", criterion: 5, applies: "ALL",
    title: "Compétences des intervenants",
    expect: "Les compétences des intervenants (internes, externes, sous-traitants) sont vérifiées à l'embauche ou à la contractualisation.",
    proofs: ["CV à jour", "Diplômes et certifications", "Grille de sélection"],
    pitfalls: "CV non à jour, intervenants externes non vérifiés.",
    links: [{ label: "Compétences des formateurs", href: "/of/qualiopi/formateurs" }],
  },
  {
    code: "22", criterion: 5, applies: "ALL", newEntrant: true,
    title: "Développement des compétences des intervenants",
    expect: "L'OF entretient et développe les compétences de ses salariés (entretiens, plan de développement des compétences).",
    proofs: ["Formations suivies par les formateurs", "Entretiens professionnels"],
    links: [{ label: "Compétences des formateurs", href: "/of/qualiopi/formateurs" }],
  },
  // ── Critère 6
  {
    code: "23", criterion: 6, applies: "ALL",
    title: "Veille légale et réglementaire",
    expect: "L'OF réalise une veille légale et réglementaire sur la formation professionnelle et en exploite les enseignements.",
    proofs: ["Fiches de veille", "Décisions prises et diffusion à l'équipe"],
    pitfalls: "Abonnements sans exploitation tracée.",
    links: [{ label: "Veille", href: "/of/qualiopi/veille" }],
  },
  {
    code: "24", criterion: 6, applies: "ALL", newEntrant: true,
    title: "Veille emplois, métiers et compétences",
    expect: "L'OF suit l'évolution des emplois, métiers et compétences de ses domaines et adapte ses formations.",
    proofs: ["Fiches de veille métiers", "Évolutions de programmes décidées"],
    links: [{ label: "Veille", href: "/of/qualiopi/veille" }],
  },
  {
    code: "25", criterion: 6, applies: "ALL", newEntrant: true,
    title: "Veille pédagogique et technologique",
    expect: "L'OF suit les innovations pédagogiques et technologiques et les intègre à ses prestations.",
    proofs: ["Fiches de veille pédagogique", "Innovations mises en œuvre"],
    links: [{ label: "Veille", href: "/of/qualiopi/veille" }],
  },
  {
    code: "26", criterion: 6, applies: "ALL", newEntrant: true,
    title: "Accueil des personnes en situation de handicap",
    expect: "L'OF mobilise l'expertise et les réseaux (référent handicap, Agefiph, Cap emploi…) pour accueillir, accompagner et orienter les personnes en situation de handicap.",
    proofs: ["Référent handicap désigné", "Registre des demandes et aménagements", "Annuaire des partenaires"],
    pitfalls: "Mention d'un référent sans processus ni cas traités.",
    links: [{ label: "Registre handicap", href: "/of/qualiopi/handicap" }],
  },
  {
    code: "27", criterion: 6, applies: "ST",
    title: "Sous-traitance et portage salarial",
    expect: "Quand l'OF sous-traite ou recourt au portage, il s'assure que le prestataire respecte le référentiel.",
    proofs: ["Contrats avec clause de conformité", "Vérification et évaluation des sous-traitants"],
    changed2026: "Contrat formalisé obligatoire traçant la vérification de conformité et la répartition des responsabilités ; portage salarial explicitement visé.",
    links: [{ label: "Sous-traitants", href: "/of/qualiopi/sous-traitants" }],
  },
  {
    code: "28", criterion: 6, applies: "ALT",
    title: "Partenaires de la formation en situation de travail",
    expect: "Pour les formations en alternance ou en situation de travail, l'OF mobilise les partenaires socio-économiques.",
    proofs: ["Conventions de partenariat"],
  },
  {
    code: "29", criterion: 6, applies: "CFA",
    title: "Insertion et poursuite d'études (CFA)",
    expect: "Le CFA accompagne l'insertion professionnelle et la poursuite d'études des apprentis.",
    proofs: ["Actions d'accompagnement"],
  },
  // ── Critère 7
  {
    code: "30", criterion: 7, applies: "ALL",
    title: "Recueillir les appréciations des parties prenantes",
    expect: "Les appréciations des bénéficiaires, entreprises, financeurs le cas échéant, et équipes sont recueillies.",
    proofs: ["Satisfaction à chaud et à froid", "Évaluations des entreprises et financeurs", "Taux de retour"],
    changed2026: "Les financeurs sont interrogés « le cas échéant » ; attention portée à la diversité des parties prenantes.",
    pitfalls: "Seuls les apprenants sont interrogés.",
    links: [{ label: "Qualité et réclamations", href: "/of/quality" }],
  },
  {
    code: "31", criterion: 7, applies: "ALL",
    title: "Traiter les difficultés, réclamations et aléas",
    expect: "Les réclamations, difficultés et aléas sont recueillis, traités et font l'objet d'une réponse.",
    proofs: ["Registre des réclamations avec réponses", "Délais de traitement"],
    pitfalls: "Registre vide ou sans réponse.",
    links: [{ label: "Qualité et réclamations", href: "/of/quality" }],
  },
  {
    code: "32", criterion: 7, applies: "ALL", newEntrant: true,
    title: "Mettre en œuvre l'amélioration continue",
    expect: "Des actions d'amélioration sont décidées à partir des appréciations, réclamations et analyses, et leur efficacité est suivie.",
    proofs: ["Plan d'amélioration", "Revue qualité", "Cartographie des risques"],
    changed2026: "Analyse des risques qualité dans une logique préventive.",
    pitfalls: "Pas de lien entre les avis recueillis et les actions.",
    links: [{ label: "Plan d'amélioration", href: "/of/qualiopi/amelioration" }],
  },
  {
    code: "33", criterion: 7, applies: "CFA", only2026: true,
    title: "Évaluation des enseignements par les apprentis (CFA)",
    expect: "Nouveau : les apprentis évaluent les contenus et les enseignements, dans un dispositif distinct de la satisfaction ; les résultats sont partagés avec les équipes et exploités.",
    proofs: ["Questionnaires par module et par enseignant", "Comptes rendus d'exploitation"],
    changed2026: "Nouvel indicateur (décret 2026-728).",
  },
];

export const indicatorsFor = (version: string) => INDICATORS.filter((i) => version === "2026" || !i.only2026);
export const findIndicator = (code: string) => INDICATORS.find((i) => i.code === code);

/** Applicabilité par défaut selon les catégories d'actions certifiées et la présence de formations certifiantes. */
export function defaultApplicable(ind: Indicator, scope: string[], opts: { hasCertifying: boolean; hasSubcontracting: boolean }) {
  const cfa = scope.includes("APPRENTISSAGE");
  switch (ind.applies) {
    case "ALL": return true;
    case "CERT": return opts.hasCertifying;
    case "ALT": return cfa;
    case "CFA": return cfa;
    case "ST": return opts.hasSubcontracting;
  }
}

export const INDICATOR_STATUS = {
  TODO: { label: "À faire", tone: "red" as const },
  IN_PROGRESS: { label: "En cours", tone: "gray" as const },
  READY: { label: "Prêt à valider", tone: "blue" as const },
  VALIDATED: { label: "Validé", tone: "green" as const },
};

export const AUDIT_TYPES: Record<string, string> = {
  INITIAL: "Audit initial",
  SURVEILLANCE: "Audit de surveillance (entre le 14e et le 22e mois)",
  RENEWAL: "Audit de renouvellement (avant 3 ans)",
  ADDITIONAL: "Audit complémentaire",
};

export const WATCH_CATEGORIES: Record<string, { label: string; indicator: string }> = {
  LEGAL: { label: "Légale et réglementaire", indicator: "23" },
  SKILLS: { label: "Emplois, métiers et compétences", indicator: "24" },
  PEDAGOGY: { label: "Pédagogique et technologique", indicator: "25" },
  HANDICAP: { label: "Handicap et accessibilité", indicator: "26" },
};

export const ACTION_SOURCES: Record<string, string> = {
  COMPLAINT: "Réclamation",
  SATISFACTION: "Satisfaction",
  FEEDBACK: "Avis entreprise / financeur",
  AUDIT: "Audit (non-conformité)",
  WATCH: "Veille",
  ABANDON: "Abandon",
  RISK: "Analyse des risques",
  INTERNAL: "Revue interne",
};

/** Une validation d'indicateur est à revoir au-delà de 12 mois (preuves datées de moins d'un an). */
export const VALIDATION_MAX_AGE_DAYS = 365;
