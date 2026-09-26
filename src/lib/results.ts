import "server-only";
import { db } from "./db";

export type ResultsBlock = {
  periodLabel: string;
  from: Date;
  to: Date;
  started: number; // Entrées en formation sur la période
  ended: number; // Sorties (terminées + abandons)
  completed: number;
  abandoned: number;
  completionRate: number | null;
  abandonRate: number | null;
  successRate: number | null; // Certificats de réussite délivrés / parcours terminés (formations avec certificat)
  hotCount: number;
  hotAverage: number | null; // /5
  hotSatisfiedRate: number | null; // part des notes ≥ 4/5
  hotResponseRate: number | null;
  coldCount: number;
  coldAverage: number | null;
  insertionAnswered: number;
  insertionRate: number | null; // en emploi, création ou formation à 6 mois
};

const r = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

/** Indicateurs de résultats d'un OF (ou d'une formation) sur les 12 derniers mois glissants. */
export async function computeResults(orgId: string, courseId?: string, months = 12): Promise<ResultsBlock> {
  const to = new Date();
  const from = new Date(to.getTime() - months * 30.44 * 86400_000);
  const course = courseId ? { id: courseId, organizationId: orgId } : { organizationId: orgId };
  const [started, completedList, abandoned, hot, cold, surveys] = await Promise.all([
    db.enrollment.count({ where: { course, enrolledAt: { gte: from, lte: to }, accessStatus: "GRANTED" } }),
    db.enrollment.findMany({ where: { course, status: "COMPLETED", completedAt: { gte: from, lte: to } }, select: { userId: true, courseId: true, course: { select: { certificateEnabled: true } } } }),
    db.enrollment.count({ where: { course, status: "ABANDONED", exitDate: { gte: from, lte: to } } }),
    db.satisfactionResponse.findMany({ where: { kind: "HOT", enrollment: { course }, createdAt: { gte: from, lte: to } }, select: { globalScore: true } }),
    db.satisfactionResponse.findMany({ where: { kind: "COLD", enrollment: { course }, createdAt: { gte: from, lte: to } }, select: { globalScore: true } }),
    db.insertionSurvey.findMany({ where: { organizationId: orgId, enrollment: { course }, answeredAt: { gte: from, lte: to } }, select: { situation: true } }),
  ]);
  const completed = completedList.length;
  const withCert = completedList.filter((e) => e.course.certificateEnabled);
  const certs = withCert.length
    ? await db.certificate.count({ where: { OR: withCert.map((e) => ({ userId: e.userId, courseId: e.courseId })) } })
    : 0;
  const ended = completed + abandoned;
  const avg = (xs: { globalScore: number }[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x.globalScore, 0) / xs.length) * 10) / 10 : null);
  const inserted = surveys.filter((s) => s.situation && ["EMPLOYED_CDI", "EMPLOYED_CDD", "SELF_EMPLOYED", "TRAINING", "SAME_JOB"].includes(s.situation)).length;
  return {
    periodLabel: `du ${from.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} au ${to.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`,
    from, to, started, ended, completed, abandoned,
    completionRate: r(completed, ended),
    abandonRate: r(abandoned, ended),
    successRate: r(certs, withCert.length),
    hotCount: hot.length,
    hotAverage: avg(hot),
    hotSatisfiedRate: r(hot.filter((h) => h.globalScore >= 4).length, hot.length),
    hotResponseRate: r(hot.length, completed),
    coldCount: cold.length,
    coldAverage: avg(cold),
    insertionAnswered: surveys.length,
    insertionRate: r(inserted, surveys.length),
  };
}

/** Méthodes de calcul publiées avec les indicateurs (exigence du référentiel 2026, indicateur 2). */
export const RESULTS_METHODS: { label: string; method: string }[] = [
  { label: "Taux de satisfaction", method: "Part des stagiaires ayant attribué une note globale d'au moins 4 sur 5 au questionnaire de fin de formation, parmi les répondants de la période." },
  { label: "Note moyenne de satisfaction", method: "Moyenne des notes globales (de 1 à 5) du questionnaire de fin de formation, puis de l'évaluation à froid (environ 2 mois après)." },
  { label: "Taux de réalisation", method: "Parcours terminés divisés par les sorties de la période (parcours terminés et abandons)." },
  { label: "Taux d'abandon", method: "Abandons (sorties anticipées déclarées) divisés par les sorties de la période." },
  { label: "Taux de réussite", method: "Certificats de réussite délivrés divisés par les parcours terminés, pour les formations donnant lieu à un certificat (moyenne aux évaluations au moins égale au seuil de validation)." },
  { label: "Taux d'insertion à 6 mois", method: "Répondants en emploi (CDI, CDD, création d'activité, maintien dans l'emploi) ou en formation, divisés par les répondants de l'enquête à 6 mois." },
];
