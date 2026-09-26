import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { VALIDATION_MAX_AGE_DAYS, defaultApplicable, indicatorsFor, type Indicator } from "./qualiopi";

export type AutoLevel = "ok" | "partial" | "missing" | "info";
export type AutoEvidence = { level: AutoLevel; facts: string[] };

const YEAR = 365 * 86400_000;
const pctStr = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");

/**
 * Preuves produites automatiquement par la plateforme, par indicateur.
 * Elles aident le référent qualité ; la validation reste une décision humaine.
 */
export async function autoEvidence(orgId: string): Promise<Record<string, AutoEvidence>> {
  const since = new Date(Date.now() - YEAR);
  const courseWhere = { organizationId: orgId };
  const [
    org, courses, enrollments, needs, applications, convocations, rulesSigned, attendance, messages,
    quizzes, graded, exits, decrochage, absences, watch, trainers, quals, accommodations, subs,
    hot, cold, feedbacks, complaints, actions, risks, resources,
  ] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId } }),
    db.course.findMany({
      where: { ...courseWhere, status: "PUBLISHED" },
      select: { id: true, title: true, objectives: true, prerequisites: true, durationHours: true, price: true, accessDelay: true, evaluationMethods: true, pedagogicalMethods: true, audience: true, rncpCode: true, skills: true, pedagogicalReferentId: true, _count: { select: { modules: true, trainers: true } } },
    }),
    db.enrollment.count({ where: { course: courseWhere, enrolledAt: { gte: since } } }),
    db.needsAnalysis.count({ where: { organizationId: orgId, createdAt: { gte: since } } }),
    db.application.count({ where: { course: courseWhere, createdAt: { gte: since }, positioning: { not: Prisma.AnyNull } } }),
    db.enrollment.count({ where: { course: courseWhere, convocationSentAt: { gte: since } } }),
    db.learnerDocument.count({ where: { organizationId: orgId, type: "INTERNAL_RULES", createdAt: { gte: since } } }),
    db.attendanceSignature.count({ where: { slot: { session: { course: courseWhere } }, signedAt: { gte: since } } }),
    db.pedagogicalMessage.count({ where: { enrollment: { course: courseWhere }, createdAt: { gte: since } } }),
    db.quizAttempt.count({ where: { quiz: { lesson: { module: { course: courseWhere } } }, submittedAt: { gte: since } } }),
    db.submission.count({ where: { lesson: { module: { course: courseWhere } }, gradedAt: { gte: since } } }),
    db.enrollment.count({ where: { course: courseWhere, exitAssessment: { not: Prisma.AnyNull }, completedAt: { gte: since } } }),
    db.enrollment.count({ where: { course: courseWhere, status: "ABANDONED", exitDate: { gte: since }, exitCategory: { not: null } } }),
    db.absenceRecord.count({ where: { enrollment: { course: courseWhere }, createdAt: { gte: since } } }),
    db.watchItem.groupBy({ by: ["category"], where: { organizationId: orgId, createdAt: { gte: since } }, _count: true }),
    db.user.findMany({ where: { organizationId: orgId, role: { in: ["TRAINER", "OF_ADMIN"] }, active: true }, select: { id: true } }),
    db.trainerQualification.findMany({ where: { organizationId: orgId, status: "VALIDATED" }, select: { userId: true, kind: true, obtainedAt: true, createdAt: true } }),
    db.accommodation.count({ where: { organizationId: orgId } }),
    db.subcontractor.findMany({ where: { organizationId: orgId }, select: { contractSignedAt: true, qualiopiCertified: true, lastEvaluationAt: true } }),
    db.satisfactionResponse.count({ where: { kind: "HOT", enrollment: { course: courseWhere }, createdAt: { gte: since } } }),
    db.satisfactionResponse.count({ where: { kind: "COLD", enrollment: { course: courseWhere }, createdAt: { gte: since } } }),
    db.funderFeedback.count({ where: { organizationId: orgId, answeredAt: { gte: since } } }),
    db.complaint.findMany({ where: { organizationId: orgId, createdAt: { gte: since } }, select: { status: true, response: true } }),
    db.improvementAction.findMany({ where: { organizationId: orgId, createdAt: { gte: since } }, select: { status: true } }),
    db.qualityRisk.count({ where: { organizationId: orgId } }),
    db.resource.count({ where: { module: { course: courseWhere } } }),
  ]);
  const completed = await db.enrollment.count({ where: { course: courseWhere, status: "COMPLETED", completedAt: { gte: since } } });

  const r: Record<string, AutoEvidence> = {};
  const set = (code: string, level: AutoLevel, ...facts: string[]) => (r[code] = { level, facts });

  // 1 — programmes complets
  const fields = (c: (typeof courses)[number]) =>
    [c.objectives, c.prerequisites, c.durationHours, c.price !== null ? 1 : null, c.accessDelay, c.evaluationMethods, c.pedagogicalMethods, c.audience].filter((v) => v !== null && v !== undefined && v !== "").length;
  const complete = courses.filter((c) => fields(c) === 8).length;
  set("1", !courses.length ? "missing" : complete === courses.length && org.referentHandicap ? "ok" : "partial",
    `${complete}/${courses.length} formation(s) publiée(s) avec un programme complet (objectifs, prérequis, public, durée, tarif, délai d'accès, méthodes, évaluation).`,
    org.referentHandicap ? `Référent handicap affiché : ${org.referentHandicap}.` : "Référent handicap non renseigné dans les paramètres de l'OF.");
  // 2 — résultats publiés
  set("2", org.publishResults ? "ok" : "missing",
    org.publishResults ? `Page publique des résultats active : /o/${org.slug}/resultats (méthode de calcul, effectif et période affichés).` : "Les indicateurs de résultats ne sont pas encore publiés.");
  // 3 — certifiants
  const certifying = courses.filter((c) => c.rncpCode);
  set("3", !certifying.length ? "info" : org.publishResults ? "ok" : "partial",
    certifying.length ? `${certifying.length} formation(s) certifiante(s) ; le taux d'obtention est calculé sur la page des résultats.` : "Aucune formation certifiante publiée.");
  // 4 — analyse du besoin
  set("4", enrollments === 0 ? "info" : needs + applications >= enrollments * 0.8 ? "ok" : needs + applications > 0 ? "partial" : "missing",
    `${needs} analyse(s) du besoin et ${applications} dossier(s) de candidature avec projet sur 12 mois, pour ${enrollments} inscription(s).`);
  // 5, 6 — objectifs, contenus
  const withObj = courses.filter((c) => c.objectives).length;
  set("5", !courses.length ? "missing" : withObj === courses.length ? "ok" : "partial", `${withObj}/${courses.length} formation(s) avec objectifs rédigés.`);
  const withContent = courses.filter((c) => c._count.modules > 0 && c.pedagogicalMethods).length;
  set("6", !courses.length ? "missing" : withContent === courses.length ? "ok" : "partial", `${withContent}/${courses.length} formation(s) avec parcours structuré et méthodes pédagogiques décrites.`);
  // 7 — certification
  const withSkills = certifying.filter((c) => c.skills.length > 0).length;
  set("7", !certifying.length ? "info" : withSkills === certifying.length ? "partial" : "missing",
    certifying.length ? `${withSkills}/${certifying.length} formation(s) certifiante(s) avec compétences visées. Joignez la correspondance avec les blocs et l'habilitation du certificateur.` : "Aucune formation certifiante.");
  // 8 — positionnement
  set("8", applications > 0 ? "partial" : enrollments ? "missing" : "info", `${applications} positionnement(s) d'entrée enregistré(s) sur 12 mois. Tracez l'exploitation (adaptations) dans l'analyse du besoin.`);
  // 9 — information
  set("9", convocations > 0 && (org.internalRulesText || org.internalRulesUrl) ? "ok" : "partial",
    `${convocations} convocation(s) envoyée(s) sur 12 mois.`, org.internalRulesText || org.internalRulesUrl ? `Règlement intérieur disponible (${rulesSigned} signature(s) sur 12 mois).` : "Règlement intérieur absent.");
  // 10 — suivi
  set("10", attendance + messages > 0 ? "ok" : enrollments ? "partial" : "info",
    `${attendance} émargement(s) et ${messages} message(s) pédagogique(s) sur 12 mois ; temps de connexion tracé automatiquement.`);
  // 11 — évaluation des acquis
  set("11", quizzes + graded + exits > 0 ? "ok" : enrollments ? "missing" : "info",
    `${quizzes} quiz, ${graded} devoir(s) corrigé(s) et ${exits} positionnement(s) de sortie sur 12 mois.`);
  // 12 — engagement, abandons, violences
  const vss = !!org.internalRulesText && /harc[eè]lement|violences/i.test(org.internalRulesText);
  set("12", vss ? "ok" : "partial",
    `${absences} absence(s) suivie(s), ${decrochage} abandon(s) avec motif analysé sur 12 mois ; alertes de décrochage à 7 jours.`,
    vss ? "Procédure violences, harcèlement et discriminations présente dans le règlement intérieur ; canal de signalement confidentiel actif." : "Ajoutez la procédure violences / harcèlement / discriminations au règlement intérieur (modèle disponible dans les paramètres).");
  // 17 — moyens
  set("17", "ok", "Plateforme Vylia : accès 24 h/24, traçabilité, assistance ; décrivez aussi vos locaux et leur accessibilité.");
  // 18, 19 — coordination, ressources, référent pédagogique
  const withRef = courses.filter((c) => c.pedagogicalReferentId).length;
  set("18", !courses.length ? "info" : withRef === courses.length ? "ok" : "partial", `${withRef}/${courses.length} formation(s) avec un référent pédagogique désigné.`);
  set("19", resources > 0 ? (withRef === courses.length ? "ok" : "partial") : "partial", `${resources} ressource(s) téléchargeable(s) mises à disposition ; ${withRef}/${courses.length} référent(s) pédagogique(s).`);
  // 21, 22 — compétences
  const qualifiedTrainers = new Set(quals.filter((q) => q.kind !== "TRAINING").map((q) => q.userId));
  const trained = new Set(quals.filter((q) => q.kind === "TRAINING" && (q.obtainedAt ?? q.createdAt) >= since).map((q) => q.userId));
  set("21", !trainers.length ? "missing" : qualifiedTrainers.size >= trainers.length ? "ok" : qualifiedTrainers.size ? "partial" : "missing",
    `${qualifiedTrainers.size}/${trainers.length} intervenant(s) avec CV ou diplômes validés.`);
  set("22", !trainers.length ? "missing" : trained.size >= trainers.length ? "ok" : trained.size ? "partial" : "missing",
    `${trained.size}/${trainers.length} intervenant(s) ayant suivi une action de développement des compétences sur 12 mois.`);
  // 23-25 — veille
  const w = (cat: string) => watch.find((x) => x.category === cat)?._count ?? 0;
  set("23", w("LEGAL") >= 2 ? "ok" : w("LEGAL") ? "partial" : "missing", `${w("LEGAL")} fiche(s) de veille légale sur 12 mois.`);
  set("24", w("SKILLS") >= 2 ? "ok" : w("SKILLS") ? "partial" : "missing", `${w("SKILLS")} fiche(s) de veille métiers sur 12 mois.`);
  set("25", w("PEDAGOGY") >= 2 ? "ok" : w("PEDAGOGY") ? "partial" : "missing", `${w("PEDAGOGY")} fiche(s) de veille pédagogique sur 12 mois.`);
  // 26 — handicap
  set("26", org.handicapReferentId || org.referentHandicap ? (accommodations || w("HANDICAP") ? "ok" : "partial") : "missing",
    org.handicapReferentId || org.referentHandicap ? "Référent handicap désigné." : "Aucun référent handicap désigné.",
    `${accommodations} demande(s) d'aménagement au registre ; ${w("HANDICAP")} fiche(s) de veille handicap.`);
  // 27 — sous-traitance
  const subsOk = subs.filter((s) => s.contractSignedAt && s.lastEvaluationAt).length;
  set("27", !subs.length ? "info" : subsOk === subs.length ? "ok" : "partial", subs.length ? `${subsOk}/${subs.length} sous-traitant(s) avec contrat formalisé et évaluation.` : "Aucun sous-traitant déclaré.");
  // 30 — appréciations
  set("30", hot && (cold || feedbacks) ? "ok" : hot ? "partial" : enrollments ? "missing" : "info",
    `${hot} avis à chaud (${pctStr(hot, completed)} des ${completed} parcours terminés), ${cold} à froid, ${feedbacks} avis d'entreprises ou financeurs sur 12 mois.`);
  // 31 — réclamations
  const answered = complaints.filter((c) => c.response).length;
  set("31", complaints.length === 0 ? "ok" : answered === complaints.length ? "ok" : "partial",
    complaints.length ? `${answered}/${complaints.length} réclamation(s) avec réponse sur 12 mois.` : "Procédure de réclamation en ligne active ; aucune réclamation sur 12 mois.");
  // 32 — amélioration continue et risques
  const done = actions.filter((a) => a.status === "DONE").length;
  set("32", actions.length && risks ? "ok" : actions.length || risks ? "partial" : "missing",
    `${actions.length} action(s) d'amélioration sur 12 mois (${done} terminée(s)) ; ${risks} risque(s) cartographié(s).`);
  return r;
}

export type IndicatorRow = {
  ind: Indicator;
  applicable: boolean;
  status: string;
  validatedAt: Date | null;
  stale: boolean; // validation de plus de 12 mois
  evidenceCount: number;
  auto?: AutoEvidence;
  comment: string | null;
  notApplicableReason: string | null;
};

/** État consolidé des indicateurs pour un OF (statut, applicabilité, preuves). */
export async function indicatorBoard(orgId: string): Promise<{ rows: IndicatorRow[]; version: string }> {
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { rnqVersion: true, qualiopiScope: true } });
  const [states, evidences, auto, certifying, subcontracting] = await Promise.all([
    db.qualityIndicator.findMany({ where: { organizationId: orgId } }),
    db.qualityEvidence.groupBy({ by: ["code"], where: { organizationId: orgId }, _count: true }),
    autoEvidence(orgId),
    db.course.count({ where: { organizationId: orgId, rncpCode: { not: null } } }),
    db.subcontractor.count({ where: { organizationId: orgId } }),
  ]);
  const rows = indicatorsFor(org.rnqVersion).map((ind) => {
    const st = states.find((s) => s.code === ind.code);
    const applicable = st ? st.applicable : defaultApplicable(ind, org.qualiopiScope, { hasCertifying: certifying > 0, hasSubcontracting: subcontracting > 0 });
    const validatedAt = st?.validatedAt ?? null;
    return {
      ind,
      applicable,
      status: st?.status ?? "TODO",
      validatedAt,
      stale: !!validatedAt && Date.now() - validatedAt.getTime() > VALIDATION_MAX_AGE_DAYS * 86400_000,
      evidenceCount: evidences.find((e) => e.code === ind.code)?._count ?? 0,
      auto: auto[ind.code],
      comment: st?.comment ?? null,
      notApplicableReason: st?.notApplicableReason ?? null,
    };
  });
  return { rows, version: org.rnqVersion };
}

/** Accès au module qualité : responsable OF ou référent qualité désigné. */
export async function canManageQuality(user: { id: string; role: string; organizationId: string | null }) {
  if (!user.organizationId) return false;
  if (user.role === "OF_ADMIN") return true;
  const org = await db.organization.findUnique({ where: { id: user.organizationId }, select: { qualityReferentId: true } });
  return org?.qualityReferentId === user.id;
}
