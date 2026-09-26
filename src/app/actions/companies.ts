"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCompany, requireOfManager, requireStaff, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify, notifyOrgManagers } from "@/lib/notify";
import { inviteStaffMember } from "@/lib/passwords";
import { companyConventionText } from "@/lib/company-convention";
import { getClientInfo } from "@/lib/request";
import { bool, optFloat, optStr, str } from "@/lib/utils";

export type CState = { error?: string; ok?: string } | undefined;

async function managerOrg() {
  const user = await requireOfManager();
  if (!user.organizationId) throw new Error("Aucun organisme rattaché");
  return { user, orgId: user.organizationId };
}

const companyData = (fd: FormData) => ({
  name: str(fd, "name").slice(0, 200),
  legalName: optStr(fd, "legalName"),
  siret: optStr(fd, "siret")?.replace(/\s/g, "") ?? null,
  address: optStr(fd, "address"),
  postalCode: optStr(fd, "postalCode"),
  city: optStr(fd, "city"),
  opcoName: optStr(fd, "opcoName"),
  contactName: optStr(fd, "contactName"),
  contactEmail: optStr(fd, "contactEmail")?.toLowerCase() ?? null,
  contactPhone: optStr(fd, "contactPhone"),
  notes: optStr(fd, "notes"),
});

// ─────────────── Fiches entreprises ───────────────

export async function createCompanyAction(_: CState, fd: FormData): Promise<CState> {
  const { user, orgId } = await managerOrg();
  const data = companyData(fd);
  if (!data.name) return { error: "Nom de l'entreprise requis." };
  if (data.siret && !/^\d{14}$/.test(data.siret)) return { error: "SIRET : 14 chiffres." };
  const c = await db.company.create({ data: { ...data, organizationId: orgId } });
  await audit("company.create", { actorId: user.id, organizationId: orgId, entityType: "Company", entityId: c.id, details: data.name });
  revalidatePath("/of/companies");
  return { ok: "Entreprise créée." };
}

export async function updateCompanyAction(id: string, _: CState, fd: FormData): Promise<CState> {
  const { user, orgId } = await managerOrg();
  await db.company.findFirstOrThrow({ where: { id, organizationId: orgId } });
  const data = companyData(fd);
  if (!data.name) return { error: "Nom de l'entreprise requis." };
  if (data.siret && !/^\d{14}$/.test(data.siret)) return { error: "SIRET : 14 chiffres." };
  await db.company.update({ where: { id }, data });
  await audit("company.update", { actorId: user.id, organizationId: orgId, entityType: "Company", entityId: id });
  revalidatePath(`/of/companies/${id}`);
  return { ok: "Fiche mise à jour." };
}

/** Informations que l'entreprise voit sur ses salariés (les salariés en sont informés par la convention et les CGU). */
export async function updateCompanySharingAction(id: string, _: CState, fd: FormData): Promise<CState> {
  const { user, orgId } = await managerOrg();
  await db.company.findFirstOrThrow({ where: { id, organizationId: orgId } });
  const data = {
    shareProgress: bool(fd, "shareProgress"),
    shareTime: bool(fd, "shareTime"),
    shareAttendance: bool(fd, "shareAttendance"),
    shareResults: bool(fd, "shareResults"),
    shareDocuments: bool(fd, "shareDocuments"),
    shareAbsenceAlerts: bool(fd, "shareAbsenceAlerts"),
    active: bool(fd, "active"),
  };
  await db.company.update({ where: { id }, data });
  await audit("company.sharing", { actorId: user.id, organizationId: orgId, entityType: "Company", entityId: id, details: data });
  revalidatePath(`/of/companies/${id}`);
  return { ok: "Paramètres de partage enregistrés." };
}

// ─────────────── Contacts de l'entreprise (rôle COMPANY) ───────────────

export async function inviteCompanyContactAction(companyId: string, _: CState, fd: FormData): Promise<CState> {
  const { user, orgId } = await managerOrg();
  const company = await db.company.findFirstOrThrow({ where: { id: companyId, organizationId: orgId } });
  const email = str(fd, "email").toLowerCase().slice(0, 200);
  const name = str(fd, "name").slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) return { error: "Nom et e-mail valides requis." };
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "Un compte existe déjà avec cet e-mail." };
  const contact = await db.user.create({
    data: {
      email, name, role: "COMPANY", organizationId: orgId, companyId: company.id,
      phone: optStr(fd, "phone"), accountStatus: "ACTIVE", createdVia: "OF",
      passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 10),
    },
  });
  const link = await inviteStaffMember(contact.id, user.name);
  await audit("company.contact_invite", { actorId: user.id, organizationId: orgId, entityType: "User", entityId: contact.id, details: { company: company.name } });
  revalidatePath(`/of/companies/${companyId}`);
  return { ok: link ? `Compte créé. L'envoi d'e-mails n'est pas configuré : transmettez ce lien d'activation (valable 7 jours) : ${link}` : `Invitation envoyée à ${email}.` };
}

export async function setCompanyContactActiveAction(userId: string, active: boolean) {
  const { user, orgId } = await managerOrg();
  const c = await db.user.findFirstOrThrow({ where: { id: userId, organizationId: orgId, role: "COMPANY" } });
  await db.user.update({ where: { id: c.id }, data: { active, sessionVersion: { increment: 1 } } });
  await audit("company.contact_active", { actorId: user.id, organizationId: orgId, entityType: "User", entityId: c.id, details: active });
  revalidatePath(`/of/companies/${c.companyId}`);
}

/** Rattache une inscription (salarié) à une entreprise cliente, ou l'en détache. */
export async function setEnrollmentCompanyAction(enrollmentId: string, _: CState, fd: FormData): Promise<CState> {
  const { user, orgId } = await managerOrg();
  const e = await db.enrollment.findFirstOrThrow({ where: { id: enrollmentId, course: { organizationId: orgId } } });
  const companyId = str(fd, "companyId");
  const company = companyId ? await db.company.findFirst({ where: { id: companyId, organizationId: orgId }, select: { id: true } }) : null;
  await db.enrollment.update({ where: { id: e.id }, data: { companyId: company?.id ?? null } });
  await audit("enrollment.company", { actorId: user.id, organizationId: orgId, entityType: "Enrollment", entityId: e.id, details: company?.id ?? null });
  revalidatePath(`/of/learners/${e.userId}`);
  return { ok: company ? "Salarié rattaché à l'entreprise." : "Rattachement retiré." };
}

// ─────────────── Conventions entreprise ───────────────

async function conventionContext(convId: string) {
  const c = await db.companyConvention.findUniqueOrThrow({
    where: { id: convId },
    include: {
      organization: true,
      company: true,
      session: { include: { course: true } },
    },
  });
  return c;
}

/** Émet une convention OF ↔ entreprise pour une session ; les contacts de l'entreprise la signent en ligne. */
export async function createCompanyConventionAction(companyId: string, _: CState, fd: FormData): Promise<CState> {
  const { user, orgId } = await managerOrg();
  const company = await db.company.findFirstOrThrow({ where: { id: companyId, organizationId: orgId }, include: { contacts: { where: { active: true }, select: { id: true } } } });
  const sessionId = str(fd, "sessionId");
  const session = sessionId ? await db.trainingSession.findFirst({ where: { id: sessionId, course: { organizationId: orgId } }, include: { enrollments: { where: { companyId }, include: { user: { select: { name: true } } } } } }) : null;
  if (!session) return { error: "Choisissez la session concernée." };
  const trainees = str(fd, "trainees").split(/\r?\n/).map((t) => t.trim()).filter(Boolean).slice(0, 200);
  const year = new Date().getFullYear();
  const conv = await db.companyConvention.create({
    data: {
      organizationId: orgId, companyId, sessionId: session.id,
      reference: `CE-${year}-${randomBytes(3).toString("hex").toUpperCase()}`,
      trainees: trainees.length ? trainees : session.enrollments.map((e) => e.user.name),
      hours: optFloat(fd, "hours"),
      price: optFloat(fd, "price") ?? session.price,
      vatRate: optFloat(fd, "vatRate") ?? 20,
      paymentTerms: optStr(fd, "paymentTerms"),
      createdById: user.id,
    },
  });
  for (const c of company.contacts) await notify(c.id, "Convention de formation à signer", session.name, `/entreprise/conventions/${conv.id}`, { email: true });
  await audit("company.convention_create", { actorId: user.id, organizationId: orgId, entityType: "CompanyConvention", entityId: conv.id });
  revalidatePath(`/of/companies/${companyId}`);
  revalidatePath(`/of/sessions/${session.id}`);
  return { ok: company.contacts.length ? "Convention émise : les contacts de l'entreprise sont invités à la signer." : "Convention émise. Invitez un contact de l'entreprise pour qu'il la signe en ligne." };
}

export async function cancelCompanyConventionAction(id: string) {
  const { user, orgId } = await managerOrg();
  const c = await db.companyConvention.findFirstOrThrow({ where: { id, organizationId: orgId, status: "SENT" } });
  await db.companyConvention.update({ where: { id: c.id }, data: { status: "CANCELLED" } });
  await audit("company.convention_cancel", { actorId: user.id, organizationId: orgId, entityType: "CompanyConvention", entityId: id });
  revalidatePath(`/of/companies/${c.companyId}`);
}

/** Signature électronique de la convention par un contact de l'entreprise (texte figé, empreinte, IP). */
export async function signCompanyConventionAction(id: string, _: CState, fd: FormData): Promise<CState> {
  const user = await requireCompany();
  const signature = str(fd, "signature");
  const signerTitle = str(fd, "signerTitle").slice(0, 120);
  if (!signature.startsWith("data:image/png;base64,") || signature.length > 400_000) return { error: "Signez dans le cadre avant de valider." };
  if (!signerTitle) return { error: "Indiquez votre fonction." };
  if (!bool(fd, "accept")) return { error: "Cochez la case d'acceptation." };
  const c = await conventionContext(id);
  if (c.companyId !== user.companyId || c.status !== "SENT") return { error: "Convention introuvable ou déjà signée." };
  if (!c.session) return { error: "Session supprimée : contactez l'organisme." };
  const { text, hash } = companyConventionText(c, c.organization, c.company, c.session.course, c.session);
  const { ip } = await getClientInfo();
  await db.companyConvention.update({
    where: { id },
    data: { status: "SIGNED", signedAt: new Date(), signerName: user.name, signerTitle, signature, signedIp: ip, signedContent: text, contentHash: hash },
  });
  await notifyOrgManagers(c.organizationId, "Convention signée par l'entreprise", `${c.company.name} · ${c.reference}`, `/of/companies/${c.companyId}`);
  await audit("company.convention_sign", { actorId: user.id, organizationId: c.organizationId, entityType: "CompanyConvention", entityId: id, details: { hash } });
  revalidatePath(`/entreprise/conventions/${id}`);
  revalidatePath("/entreprise");
  return { ok: "Convention signée. Un exemplaire reste disponible dans votre espace." };
}

// ─────────────── Analyse du besoin (indicateur 4) ───────────────

/** Recueil du besoin de l'entreprise pour une session : saisi par l'entreprise dans son espace ou par l'OF. */
export async function saveNeedsAnalysisAction(companyId: string, sessionId: string, _: CState, fd: FormData): Promise<CState> {
  const user = await requireUser();
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const staff = user.role === "OF_ADMIN" || user.role === "TRAINER";
  if (staff ? user.organizationId !== company.organizationId : user.role !== "COMPANY" || user.companyId !== companyId) return { error: "Action non autorisée." };
  const session = await db.trainingSession.findFirst({ where: { id: sessionId, course: { organizationId: company.organizationId } }, select: { id: true } });
  if (!session) return { error: "Session introuvable." };
  const context = str(fd, "context");
  const objectives = str(fd, "objectives");
  if (context.length < 10 || objectives.length < 10) return { error: "Décrivez le contexte et les objectifs attendus." };
  const existing = await db.needsAnalysis.findFirst({ where: { companyId, sessionId } });
  const data = {
    context, objectives,
    constraints: optStr(fd, "constraints"),
    ...(staff ? { adaptations: optStr(fd, "adaptations") } : {}),
    ...(staff && bool(fd, "validate") ? { validatedById: user.id, validatedAt: new Date() } : {}),
  };
  if (existing) await db.needsAnalysis.update({ where: { id: existing.id }, data });
  else await db.needsAnalysis.create({ data: { ...data, organizationId: company.organizationId, companyId, sessionId, filledByRole: staff ? "OF" : "COMPANY", filledById: user.id } });
  if (!staff) await notifyOrgManagers(company.organizationId, "Besoin de formation exprimé par l'entreprise", company.name, `/of/companies/${companyId}`);
  await audit("company.needs_analysis", { actorId: user.id, organizationId: company.organizationId, entityType: "Company", entityId: companyId, details: { sessionId } });
  revalidatePath(`/of/companies/${companyId}`);
  revalidatePath("/entreprise");
  return { ok: "Analyse du besoin enregistrée." };
}

/** Demande d'évaluation à froid à l'entreprise (indicateur 30) : lien sécurisé, visible aussi dans son espace. */
export async function requestCompanyFeedbackAction(enrollmentId: string) {
  const user = await requireStaff();
  const e = await db.enrollment.findFirstOrThrow({ where: { id: enrollmentId, course: { organizationId: user.organizationId ?? "__" } }, include: { company: { include: { contacts: { where: { active: true }, select: { id: true } } } } } });
  if (!e.company) throw new Error("Inscription non rattachée à une entreprise");
  const fb = await db.funderFeedback.create({
    data: { token: randomBytes(24).toString("base64url"), organizationId: user.organizationId!, enrollmentId: e.id, respondentType: "EMPLOYER", respondentName: e.company.name },
  });
  for (const c of e.company.contacts) await notify(c.id, "Votre avis sur la formation de votre salarié", "Quelques questions pour évaluer l'impact de la formation.", `/feedback/${fb.token}`, { email: true });
  await audit("company.feedback_request", { actorId: user.id, organizationId: user.organizationId, entityType: "Enrollment", entityId: e.id });
  revalidatePath(`/of/companies/${e.companyId}`);
}
