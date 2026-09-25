"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { ComplaintStatus, EnrollmentStatus, FundingType, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOfManager, requireStaff } from "@/lib/auth";
import { assertCanManageCourse, canAdministerOrg, canManageOrg } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { inviteStaffMember } from "@/lib/passwords";
import { notify, notifyOrgManagers } from "@/lib/notify";
import { ACCOUNT_DOCUMENT_CHOICES, DOCUMENT_TYPES, ENROLLMENT_DOCUMENTS, FUNDING_TYPES, LOCKED_ORG_FIELDS, isOrgFieldFilled, type LockedOrgField } from "@/lib/labels";
import { bool, optFloat, optInt, optStr, randomCode, safeUrl, str } from "@/lib/utils";

export type ActionState = { error?: string; ok?: string } | undefined;

function dateOrNull(v: string) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─────────────── Paramètres de l'organisme ───────────────

export async function updateOrganizationAction(orgId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireOfManager();
  if (!canAdministerOrg(user, orgId)) return { error: "Accès refusé." };
  const siret = str(fd, "siret").replace(/\s/g, "");
  if (siret && !/^\d{14}$/.test(siret)) return { error: "Le SIRET doit comporter 14 chiffres." };
  const nda = str(fd, "nda").replace(/\s/g, "");
  if (nda && !/^\d{11}$/.test(nda)) return { error: "Le numéro de déclaration d'activité comporte 11 chiffres." };
    const timeout = optInt(fd, "inactivityTimeoutMin") ?? 15;
  if (timeout < 2 || timeout > 120) return { error: "Délai d'inactivité : entre 2 et 120 minutes." };
  const interactiveTimeout = optInt(fd, "interactiveTimeoutMin") ?? 45;
  if (interactiveTimeout < timeout || interactiveTimeout > 180) {
    return { error: "Délai d'inactivité des modules interactifs : entre le délai standard et 180 minutes." };
  }
  const supportResponseHours = optInt(fd, "supportResponseHours") ?? 24;
  if (supportResponseHours < 1 || supportResponseHours > 168) return { error: "Délai de réponse de l'assistance : entre 1 et 168 heures." };
  const supportReferentId = str(fd, "supportReferentId") || null;
  if (supportReferentId && !(await db.user.findFirst({ where: { id: supportReferentId, organizationId: orgId, role: "OF_ADMIN", active: true }, select: { id: true } }))) {
    return { error: "Le référent support doit être un responsable actif de l'organisme." };
  }
  const data = {
    supportReferentId,
    name: str(fd, "name") || "Organisme",
    legalName: optStr(fd, "legalName"),
    siret: siret || null,
    nda: nda || null,
    ndaRegion: optStr(fd, "ndaRegion"),
    qualiopiNumber: optStr(fd, "qualiopiNumber"),
    qualiopiDate: dateOrNull(str(fd, "qualiopiDate")),
    address: optStr(fd, "address"),
    postalCode: optStr(fd, "postalCode"),
    city: optStr(fd, "city"),
    phone: optStr(fd, "phone"),
    email: optStr(fd, "email"),
    website: safeUrl(str(fd, "website")),
    logoUrl: safeUrl(str(fd, "logoUrl")),
    managerName: optStr(fd, "managerName"),
    managerTitle: optStr(fd, "managerTitle"),
    internalRulesUrl: safeUrl(str(fd, "internalRulesUrl")),
    cgvUrl: safeUrl(str(fd, "cgvUrl")),
    requiredDocuments: fd.getAll("requiredDocuments").map(String).filter((c) => c in DOCUMENT_TYPES),
        inactivityTimeoutMin: timeout,
    interactiveTimeoutMin: interactiveTimeout,
    referentHandicap: optStr(fd, "referentHandicap"),
    mediatorInfo: optStr(fd, "mediatorInfo"),
    // Inscription à la plateforme
    requireAccountValidation: bool(fd, "requireAccountValidation"),
    accountRequiredDocuments: fd.getAll("accountRequiredDocuments").map(String).filter((c) => (ACCOUNT_DOCUMENT_CHOICES as readonly string[]).includes(c)),
    // Accès aux parcours
    enrollmentRequiredDocuments: fd.getAll("enrollmentRequiredDocuments").map(String).filter((c) => c in ENROLLMENT_DOCUMENTS),
    autoGrantAccess: bool(fd, "autoGrantAccess"),
    cgvText: optStr(fd, "cgvText")?.slice(0, 100_000) ?? null,
    internalRulesText: optStr(fd, "internalRulesText")?.slice(0, 100_000) ?? null,
    // Assistance
    supportEnabled: bool(fd, "supportEnabled"),
    supportHours: optStr(fd, "supportHours"),
    supportResponseHours,
    supportAutoReply: optStr(fd, "supportAutoReply"),
  };
  const current = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  const lockedKeys = Object.keys(LOCKED_ORG_FIELDS) as LockedOrgField[];
  const same = (a: unknown, b: unknown) => (a instanceof Date ? a.getTime() : a ?? null) === (b instanceof Date ? b.getTime() : b ?? null);
  if (user.role !== "ADMIN") {
    // Informations déjà renseignées : seul le support Vylia peut les modifier (sur demande par ticket)
    for (const k of lockedKeys) if (isOrgFieldFilled(current[k])) delete (data as Partial<typeof data>)[k];
  }
  const changedIdentity = lockedKeys.filter((k) => k in data && !same(data[k], current[k]));
  await db.organization.update({ where: { id: orgId }, data });
  await audit("organization.update", {
    actorId: user.id,
    organizationId: orgId,
    entityType: "Organization",
    entityId: orgId,
    details: changedIdentity.length ? { identite: changedIdentity.map((k) => LOCKED_ORG_FIELDS[k]).join(", ") } : undefined,
  });
  if (user.role === "ADMIN" && changedIdentity.length) {
    await notifyOrgManagers(
      orgId,
      "Informations de l'organisme mises à jour",
      `Le support Vylia a modifié : ${changedIdentity.map((k) => LOCKED_ORG_FIELDS[k]).join(", ")}.`,
      "/of/settings",
    );
  }
  revalidatePath("/of", "layout");
  revalidatePath(`/admin/organizations/${orgId}`);
  return { ok: "Paramètres enregistrés." };
}

// ─────────────── Équipe OF ───────────────

export async function createTeamMemberAction(orgId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireOfManager();
  if (!canAdministerOrg(user, orgId)) return { error: "Accès refusé." };
  const email = str(fd, "email").toLowerCase();
  const name = str(fd, "name");
  const role = str(fd, "role") as Role;
  if (!["OF_ADMIN", "TRAINER"].includes(role)) return { error: "Rôle invalide." };
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Nom et email valides requis." };
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === "LEARNER" || existing.role === "ADMIN") return { error: "Cet email est déjà utilisé par un autre compte." };
    if (existing.organizationId && existing.organizationId !== orgId) return { error: "Ce membre appartient à un autre organisme." };
    await db.user.update({ where: { id: existing.id }, data: { organizationId: orgId, role, active: true } });
    await audit("user.role", { actorId: user.id, organizationId: orgId, entityType: "User", entityId: existing.id, details: { role } });
    revalidatePath("/of/team");
  revalidatePath("/admin/organizations", "layout");
    return { ok: `${email} rattaché(e) à l'équipe.` };
  }
  const created = await db.user.create({
    data: { email, name: name.slice(0, 120), role, organizationId: orgId, passwordHash: await bcrypt.hash(randomCode(24), 10), createdVia: user.role === "ADMIN" ? "ADMIN" : "OF" },
  });
  await audit("user.create", { actorId: user.id, organizationId: orgId, entityType: "User", entityId: created.id, details: { role } });
  const link = await inviteStaffMember(created.id, user.name);
  revalidatePath("/of/team");
  revalidatePath("/admin/organizations", "layout");
  return { ok: link ? `Compte créé : transmettez ce lien d'activation personnel (7 jours) à ${email} : ${link}` : `Compte créé : une invitation a été envoyée à ${email}.` };
}

/**
 * Rôle (responsable / formateur) ou activation d'un membre de l'équipe.
 * Les arguments viennent du client : chaque champ est validé, aucun autre n'est accepté.
 */
export async function setTeamMemberAction(memberId: string, patch: { role?: "OF_ADMIN" | "TRAINER"; active?: boolean }) {
  const user = await requireOfManager();
  const data: { role?: "OF_ADMIN" | "TRAINER"; active?: boolean } = {};
  if (patch && typeof patch === "object") {
    if ("role" in patch) {
      if (patch.role !== "OF_ADMIN" && patch.role !== "TRAINER") throw new Error("Rôle invalide");
      data.role = patch.role;
    }
    if ("active" in patch) {
      if (typeof patch.active !== "boolean") throw new Error("Valeur invalide");
      data.active = patch.active;
    }
    if (Object.keys(patch).some((k) => k !== "role" && k !== "active")) throw new Error("Modification non autorisée");
  }
  if (!Object.keys(data).length) throw new Error("Aucune modification");
  const member = await db.user.findUniqueOrThrow({ where: { id: String(memberId) } });
  if (!canAdministerOrg(user, member.organizationId) || member.role === "ADMIN" || member.role === "LEARNER") throw new Error("Accès refusé");
  if (member.id === user.id) throw new Error("Vous ne pouvez pas modifier votre propre compte ici");
  // Changement de rôle ou désactivation : les sessions ouvertes du membre sont fermées
  await db.user.update({ where: { id: member.id }, data: { ...data, sessionVersion: { increment: 1 } } });
  await audit(data.role ? "user.role" : "user.active", { actorId: user.id, organizationId: member.organizationId, entityType: "User", entityId: member.id, details: data });
  revalidatePath("/of/team");
  revalidatePath("/admin/organizations", "layout");
}

// ─────────────── Sessions de formation & émargement ───────────────

export async function createSessionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const courseId = str(fd, "courseId");
  await assertCanManageCourse(user, courseId);
  const startDate = dateOrNull(str(fd, "startDate"));
  const endDate = dateOrNull(str(fd, "endDate"));
  if (!startDate || !endDate || endDate < startDate) return { error: "Dates invalides." };
  await db.trainingSession.create({
    data: {
      courseId,
      name: str(fd, "name") || `Session du ${startDate.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`,
      startDate,
      endDate,
      capacity: optInt(fd, "capacity"),
      location: optStr(fd, "location"),
      open: true,
    },
  });
  revalidatePath("/of/sessions");
  return { ok: "Session créée." };
}

export async function updateSessionAction(sessionId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const s = await db.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  await assertCanManageCourse(user, s.courseId);
  const startDate = dateOrNull(str(fd, "startDate"));
  const endDate = dateOrNull(str(fd, "endDate"));
  if (!startDate || !endDate || endDate < startDate) return { error: "Dates invalides." };
  await db.trainingSession.update({
    where: { id: sessionId },
    data: { name: str(fd, "name") || s.name, startDate, endDate, capacity: optInt(fd, "capacity"), location: optStr(fd, "location"), open: bool(fd, "open") },
  });
  revalidatePath(`/of/sessions/${sessionId}`);
  return { ok: "Session mise à jour." };
}

export async function deleteSessionAction(sessionId: string) {
  const user = await requireStaff();
  const s = await db.trainingSession.findUniqueOrThrow({ where: { id: sessionId }, include: { _count: { select: { enrollments: true } } } });
  await assertCanManageCourse(user, s.courseId);
  if (s._count.enrollments > 0) throw new Error("Impossible : des apprenants sont inscrits sur cette session");
  await db.trainingSession.delete({ where: { id: sessionId } });
  revalidatePath("/of/sessions");
}

/** Génère les créneaux d'émargement (matin / après-midi) sur une période, pour les jours choisis. */
export async function generateSlotsAction(sessionId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const s = await db.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  await assertCanManageCourse(user, s.courseId);
  const from = dateOrNull(str(fd, "from"));
  const to = dateOrNull(str(fd, "to"));
  if (!from || !to || to < from) return { error: "Période invalide." };
  if (to.getTime() - from.getTime() > 366 * 86400000) return { error: "Période limitée à un an." };
  const weekdays = fd.getAll("weekday").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (!weekdays.length) return { error: "Choisissez au moins un jour de la semaine." };
  const periods: { label: string; start: string; end: string }[] = [];
  if (bool(fd, "morning")) periods.push({ label: "Matin", start: str(fd, "morningStart") || "09:00", end: str(fd, "morningEnd") || "12:30" });
  if (bool(fd, "afternoon")) periods.push({ label: "Après-midi", start: str(fd, "afternoonStart") || "13:30", end: str(fd, "afternoonEnd") || "17:00" });
  if (!periods.length) return { error: "Choisissez au moins une demi-journée." };
  let count = 0;
  for (let d = new Date(from); d <= to && count <= 400; d = new Date(d.getTime() + 86400000)) {
    if (!weekdays.includes(d.getUTCDay())) continue;
    for (const p of periods) {
      const exists = await db.attendanceSlot.findFirst({ where: { sessionId, date: d, label: p.label } });
      if (exists) continue;
      await db.attendanceSlot.create({ data: { sessionId, date: d, label: p.label, startTime: p.start, endTime: p.end } });
      count++;
      if (count > 400) break;
    }
  }
  revalidatePath(`/of/sessions/${sessionId}`);
  return { ok: `${count} créneau(x) créé(s).` };
}

export async function addSlotAction(sessionId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const s = await db.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  await assertCanManageCourse(user, s.courseId);
  const date = dateOrNull(str(fd, "date"));
  if (!date) return { error: "Date invalide." };
  await db.attendanceSlot.create({
    data: { sessionId, date, label: str(fd, "label") || "Classe virtuelle", startTime: str(fd, "startTime") || "09:00", endTime: str(fd, "endTime") || "12:00" },
  });
  revalidatePath(`/of/sessions/${sessionId}`);
  return { ok: "Créneau ajouté." };
}

export async function deleteSlotAction(slotId: string) {
  const user = await requireStaff();
  const slot = await db.attendanceSlot.findUniqueOrThrow({ where: { id: slotId }, include: { session: true, _count: { select: { signatures: true } } } });
  await assertCanManageCourse(user, slot.session.courseId);
  if (slot._count.signatures > 0) throw new Error("Créneau déjà signé : suppression impossible (preuve de présence)");
  await db.attendanceSlot.delete({ where: { id: slotId } });
  revalidatePath(`/of/sessions/${slot.sessionId}`);
}

// ─────────────── Inscriptions ───────────────

export async function updateEnrollmentAction(enrollmentId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireOfManager();
  const e = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, include: { course: { select: { organizationId: true, title: true } } } });
  if (!canManageOrg(user, e.course.organizationId)) return { error: "Accès refusé." };
  const startDate = dateOrNull(str(fd, "startDate"));
  const endDate = dateOrNull(str(fd, "endDate"));
  if (startDate && endDate && endDate < startDate) return { error: "La date de fin doit suivre la date de début." };
    const status = str(fd, "status") as EnrollmentStatus;
  if (!["ACTIVE", "COMPLETED", "SUSPENDED", "ABANDONED"].includes(status)) return { error: "Statut invalide." };
  const exitDate = dateOrNull(str(fd, "exitDate"));
  const exitCategory = optStr(fd, "exitCategory");
  const exitReason = optStr(fd, "exitReason");
  if ((status === "ABANDONED" || status === "SUSPENDED") && (!exitDate || !exitCategory)) {
    return { error: "Pour une interruption ou un abandon, la date de sortie et le motif sont obligatoires." };
  }
  if (exitDate && startDate && exitDate < startDate) return { error: "La date de sortie ne peut précéder le début de la formation." };
  const sessionId = optStr(fd, "sessionId");
  if (sessionId && !(await db.trainingSession.findFirst({ where: { id: sessionId, courseId: e.courseId }, select: { id: true } }))) {
    return { error: "Session invalide pour cette formation." };
  }
  const ft = str(fd, "fundingType");
  if (ft && !(ft in FUNDING_TYPES)) return { error: "Financement invalide." };
  const data = {
    startDate,
    endDate,
    plannedHours: optFloat(fd, "plannedHours"),
    fundingType: (str(fd, "fundingType") || null) as FundingType | null,
    fundingReference: optStr(fd, "fundingReference"),
    sessionId,
        status,
    completedAt: status === "COMPLETED" ? e.completedAt ?? new Date() : status === "ACTIVE" ? null : e.completedAt,
    exitDate: status === "ABANDONED" || status === "SUSPENDED" ? exitDate : null,
    exitCategory: status === "ABANDONED" || status === "SUSPENDED" ? exitCategory : null,
    exitReason: status === "ABANDONED" || status === "SUSPENDED" ? exitReason : null,
  };
  await db.enrollment.update({ where: { id: enrollmentId }, data });
  await audit(status !== e.status ? "enrollment.status" : "enrollment.update", {
    actorId: user.id,
    organizationId: e.course.organizationId,
    entityType: "Enrollment",
    entityId: enrollmentId,
    details: { ...data, previousStatus: e.status },
  });
  if (status !== e.status) {
        const labels = { ACTIVE: "réactivée", COMPLETED: "clôturée", SUSPENDED: "interrompue", ABANDONED: "clôturée (abandon)" };
    await notify(e.userId, `Votre inscription à « ${e.course.title} » est ${labels[status]}`, null, "/learn");
  }
  revalidatePath(`/of/learners/${e.userId}`);
  return { ok: "Inscription mise à jour." };
}

// ─────────────── Qualité : réclamations ───────────────

export async function respondComplaintAction(complaintId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireOfManager();
  const c = await db.complaint.findUniqueOrThrow({ where: { id: complaintId } });
  if (!canManageOrg(user, c.organizationId)) return { error: "Accès refusé." };
  const status = str(fd, "status") as ComplaintStatus;
  if (!["OPEN", "IN_PROGRESS", "RESOLVED"].includes(status)) return { error: "Statut invalide." };
  const response = optStr(fd, "response");
  if (status === "RESOLVED" && !response) return { error: "Rédigez une réponse avant de clôturer." };
  await db.complaint.update({
    where: { id: complaintId },
    data: { status, response, handledById: user.id, resolvedAt: status === "RESOLVED" ? new Date() : null },
  });
  if (response) await notify(c.userId, `Réponse à votre demande : ${c.subject}`, response.slice(0, 140), "/support");
  await audit("complaint.update", { actorId: user.id, organizationId: c.organizationId, entityType: "Complaint", entityId: c.id, details: { status } });
  revalidatePath("/of/quality");
  return { ok: "Réclamation mise à jour." };
}
