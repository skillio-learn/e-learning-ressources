import "server-only";
import { db } from "./db";
import { notify, notifyOrgManagers } from "./notify";
import { audit } from "./audit";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Créneaux passés non signés et non justifiés d'un stagiaire sur sa session. */
export async function unjustifiedAbsences(enrollmentId: string) {
  const e = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { userId: true, sessionId: true },
  });
  if (!e?.sessionId) return [];
  const today = iso(new Date());
  const slots = await db.attendanceSlot.findMany({
    where: { sessionId: e.sessionId },
    select: { id: true, date: true, label: true, signatures: { where: { userId: e.userId }, select: { id: true } }, absences: { where: { userId: e.userId }, select: { status: true, kind: true } } },
  });
  return slots.filter((s) => iso(s.date) < today && !s.signatures.length && !s.absences.some((a) => a.status === "ACCEPTED" || (a.status === "PENDING" && a.kind === "ABSENCE")));
}

/**
 * Alerte d'absences : au-delà du seuil fixé par l'OF, le responsable, le formateur, le stagiaire et, si l'OF l'a activé,
 * l'entreprise cliente sont prévenus (une alerte au plus par semaine et par inscription).
 */
export async function checkAbsenceAlert(enrollmentId: string) {
  const e = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      user: { select: { id: true, name: true } },
      course: { select: { title: true, organization: { select: { id: true, absenceAlertThreshold: true, notifyEmployerOnAbsence: true } } } },
      session: { select: { trainerId: true, name: true } },
      company: { select: { id: true, shareAbsenceAlerts: true, active: true, contacts: { where: { active: true }, select: { id: true } } } },
    },
  });
  if (!e || e.status !== "ACTIVE" || !e.sessionId) return false;
  const org = e.course.organization;
  const threshold = org.absenceAlertThreshold ?? 2;
  if (threshold <= 0) return false;
  if (e.absenceAlertAt && Date.now() - e.absenceAlertAt.getTime() < 7 * 86400_000) return false;
  const missing = await unjustifiedAbsences(e.id);
  if (missing.length < threshold) return false;
  const body = `${e.user.name} · ${e.course.title} : ${missing.length} demi-journée(s) d'absence non justifiée(s).`;
  await notifyOrgManagers(org.id, "Alerte d'absences", body, `/of/sessions/${e.sessionId}`);
  if (e.session?.trainerId) await notify(e.session.trainerId, "Alerte d'absences", body, `/of/sessions/${e.sessionId}`);
  await notify(e.user.id, "Absences à justifier", `${missing.length} demi-journée(s) sans émargement ni justificatif. Déposez vos justificatifs dans « Émargement ».`, "/attendance", { email: true });
  if (org.notifyEmployerOnAbsence && e.company?.active && e.company.shareAbsenceAlerts) {
    for (const c of e.company.contacts) await notify(c.id, "Absences d'un salarié en formation", body, "/entreprise", { email: true });
  }
  await db.enrollment.update({ where: { id: e.id }, data: { absenceAlertAt: new Date() } });
  await audit("absence.alert", { organizationId: org.id, entityType: "Enrollment", entityId: e.id, details: { count: missing.length } });
  return true;
}
