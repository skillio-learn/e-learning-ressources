import "server-only";
import { randomBytes } from "crypto";
import { db } from "./db";
import { notify, notifyOrgManagers } from "./notify";
import { checkAbsenceAlert } from "./absences";

const DAY = 86400_000;
const month = (n: number) => n * 30.44 * DAY;

/** Enquêtes d'insertion à 6 mois : créées et envoyées aux stagiaires ayant terminé il y a 6 mois (fenêtre de 6 mois). */
async function insertionSurveys() {
  const now = Date.now();
  const due = await db.enrollment.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { lte: new Date(now - month(6)), gte: new Date(now - month(12)) },
      insertionSurveys: { none: { horizonMonths: 6 } },
      user: { active: true },
    },
    take: 200,
    select: { id: true, userId: true, completedAt: true, course: { select: { title: true, organizationId: true } } },
  });
  for (const e of due) {
    const s = await db.insertionSurvey.create({
      data: { token: randomBytes(24).toString("base64url"), organizationId: e.course.organizationId, enrollmentId: e.id, horizonMonths: 6, dueAt: new Date(e.completedAt!.getTime() + month(6)), sentAt: new Date() },
    });
    await notify(e.userId, "Que devenez-vous ?", `Six mois après la formation « ${e.course.title} », trois questions pour mesurer son utilité.`, `/survey/${s.token}`, { email: true });
  }
  return due.length;
}

/** Rappel des tâches en retard (au plus tous les 3 jours). */
async function overdueTasks() {
  const now = new Date();
  const tasks = await db.task.findMany({
    where: { status: "OPEN", dueAt: { lt: now }, assigneeId: { not: null }, OR: [{ remindedAt: null }, { remindedAt: { lt: new Date(now.getTime() - 3 * DAY) } }] },
    take: 500,
  });
  for (const t of tasks) {
    await notify(t.assigneeId!, "Tâche en retard", t.title, "/of/tasks");
    await db.task.update({ where: { id: t.id }, data: { remindedAt: now } });
  }
  return tasks.length;
}

/** Alertes d'absences des stagiaires dont la session a eu des créneaux ces 14 derniers jours. */
async function absenceAlerts() {
  const since = new Date(Date.now() - 14 * DAY);
  const enrollments = await db.enrollment.findMany({
    where: { status: "ACTIVE", session: { slots: { some: { date: { gte: since, lt: new Date() } } } } },
    select: { id: true },
    take: 1000,
  });
  let n = 0;
  for (const e of enrollments) if (await checkAbsenceAlert(e.id)) n++;
  return n;
}

/** Qualiopi : non-conformités à lever sous 15 jours et audits dans 30 jours (rappels ponctuels). */
async function qualityReminders() {
  const now = Date.now();
  const inDays = (d: number) => new Date(now + d * DAY);
  const ncs = await db.nonConformity.findMany({
    where: { status: "OPEN", dueAt: { gte: inDays(14), lt: inDays(15) } },
    select: { organizationId: true, indicatorCode: true, level: true },
  });
  for (const nc of ncs) {
    await notifyOrgManagers(nc.organizationId, "Non-conformité à lever sous 15 jours", `Indicateur ${nc.indicatorCode} (${nc.level === "MAJOR" ? "majeure" : "mineure"}) : envoyez vos preuves au certificateur.`, "/of/qualiopi/audits");
  }
  const audits = await db.qualityAudit.findMany({
    where: { status: "PLANNED", scheduledAt: { gte: inDays(30), lt: inDays(31) } },
    select: { organizationId: true, scheduledAt: true },
  });
  for (const a of audits) {
    await notifyOrgManagers(a.organizationId, "Audit Qualiopi dans 30 jours", "Vérifiez le parcours de conformité et le dossier de preuves.", "/of/qualiopi");
  }
  return ncs.length + audits.length;
}

export async function runDailyJobs() {
  const results: Record<string, number | string> = {};
  for (const [name, job] of Object.entries({ insertionSurveys, overdueTasks, absenceAlerts, qualityReminders })) {
    try {
      results[name] = await job();
    } catch (e) {
      console.error(`cron ${name} failed`, e);
      results[name] = "erreur";
    }
  }
  return results;
}
