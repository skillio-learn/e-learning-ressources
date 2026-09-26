"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { readUpload } from "@/lib/uploads";
import { canManageQuality } from "@/lib/qualiopi-evidence";
import { hashToken } from "@/lib/tokens";
import { ACTION_SOURCES, AUDIT_TYPES, WATCH_CATEGORIES, findIndicator } from "@/lib/qualiopi";
import { bool, optStr, safeUrl, str } from "@/lib/utils";

export type QState = { error?: string; ok?: string; link?: string } | undefined;

const dateOrNull = (v: string) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const clampInt = (v: string, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isInteger(n) ? Math.max(min, Math.min(max, n)) : def;
};

/** Responsable OF ou référent qualité désigné, rattaché à un organisme. */
async function requireQuality() {
  const user = await requireStaff();
  if (!user.organizationId || !(await canManageQuality(user))) throw new Error("Réservé au responsable de l'organisme et au référent qualité");
  return { user, orgId: user.organizationId };
}

const refresh = (...paths: string[]) => {
  revalidatePath("/of/qualiopi", "layout");
  for (const p of paths) revalidatePath(p);
};

// ─────────────── Paramètres de certification ───────────────

export async function saveQualiopiSettingsAction(_: QState, fd: FormData): Promise<QState> {
  const { user, orgId } = await requireQuality();
  const scope = fd.getAll("scope").map(String).filter((s) => ["ACTIONS", "BILAN", "VAE", "APPRENTISSAGE"].includes(s));
  const members = await db.user.findMany({ where: { organizationId: orgId, role: { in: ["OF_ADMIN", "TRAINER"] }, active: true }, select: { id: true } });
  const member = (id: string) => (id && members.some((m) => m.id === id) ? id : null);
  const version = str(fd, "rnqVersion") === "2019" ? "2019" : "2026";
  await db.organization.update({
    where: { id: orgId },
    data: {
      // Certification (numéro, dates, certificateur) : renseignée par le support Vylia sur justificatif, non modifiable ici
      qualiopiScope: scope.length ? scope : ["ACTIONS"],
      rnqVersion: version,
      qualityReferentId: member(str(fd, "qualityReferentId")),
      handicapReferentId: member(str(fd, "handicapReferentId")),
    },
  });
  await audit("quality.settings", { actorId: user.id, organizationId: orgId, details: { version, scope } });
  refresh();
  return { ok: "Paramètres Qualiopi enregistrés." };
}

// ─────────────── Indicateurs et preuves ───────────────

export async function saveIndicatorAction(code: string, _: QState, fd: FormData): Promise<QState> {
  const { user, orgId } = await requireQuality();
  if (!findIndicator(code)) return { error: "Indicateur inconnu." };
  const applicable = !bool(fd, "notApplicable");
  const reason = optStr(fd, "notApplicableReason");
  if (!applicable && !reason) return { error: "Indiquez pourquoi l'indicateur ne s'applique pas (l'auditeur le demandera)." };
  const validate = str(fd, "intent") === "validate";
  const status = validate ? "VALIDATED" : ["TODO", "IN_PROGRESS", "READY"].includes(str(fd, "status")) ? str(fd, "status") : "IN_PROGRESS";
  const data = {
    applicable,
    notApplicableReason: applicable ? null : reason,
    status,
    comment: optStr(fd, "comment"),
    ...(validate ? { validatedById: user.id, validatedAt: new Date() } : status !== "VALIDATED" ? { validatedById: null, validatedAt: null } : {}),
  };
  await db.qualityIndicator.upsert({ where: { organizationId_code: { organizationId: orgId, code } }, create: { organizationId: orgId, code, ...data }, update: data });
  await audit(validate ? "quality.indicator_validate" : "quality.indicator_update", { actorId: user.id, organizationId: orgId, entityType: "QualityIndicator", entityId: code, details: { status, applicable } });
  refresh(`/of/qualiopi/indicateurs/${code}`);
  return { ok: validate ? `Indicateur ${code} validé.` : "Enregistré." };
}

export async function addEvidenceAction(code: string, _: QState, fd: FormData): Promise<QState> {
  const { user, orgId } = await requireQuality();
  if (!findIndicator(code)) return { error: "Indicateur inconnu." };
  const title = str(fd, "title").slice(0, 200);
  if (!title) return { error: "Donnez un titre à la preuve." };
  const url = safeUrl(str(fd, "url"));
  const up = await readUpload(fd, { kind: "resource", required: false });
  if ("error" in up) return up;
  if (!url && !up.file && !str(fd, "description")) return { error: "Joignez un fichier, un lien ou une description." };
  await db.qualityEvidence.create({
    data: { organizationId: orgId, code, title, description: optStr(fd, "description"), url, ...(up.file ?? {}), createdById: user.id },
  });
  await audit("quality.evidence_add", { actorId: user.id, organizationId: orgId, entityType: "QualityEvidence", entityId: code, details: title });
  refresh(`/of/qualiopi/indicateurs/${code}`);
  return { ok: "Preuve ajoutée." };
}

export async function deleteEvidenceAction(id: string) {
  const { user, orgId } = await requireQuality();
  const e = await db.qualityEvidence.findFirstOrThrow({ where: { id, organizationId: orgId } });
  await db.qualityEvidence.delete({ where: { id } });
  await audit("quality.evidence_delete", { actorId: user.id, organizationId: orgId, entityType: "QualityEvidence", entityId: e.code, details: e.title });
  refresh(`/of/qualiopi/indicateurs/${e.code}`);
}

// ─────────────── Amélioration continue et risques ───────────────

export async function saveActionAction(id: string | null, _: QState, fd: FormData): Promise<QState> {
  const { user, orgId } = await requireQuality();
  const title = str(fd, "title").slice(0, 200);
  if (!title) return { error: "Décrivez l'action en une phrase." };
  const source = str(fd, "source") in ACTION_SOURCES ? str(fd, "source") : "INTERNAL";
  const status = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"].includes(str(fd, "status")) ? str(fd, "status") : "OPEN";
  const ownerId = str(fd, "ownerId");
  const owner = ownerId ? await db.user.findFirst({ where: { id: ownerId, organizationId: orgId, role: { in: ["OF_ADMIN", "TRAINER"] } }, select: { id: true } }) : null;
  const code = str(fd, "indicatorCode");
  const data = {
    title,
    source,
    sourceRef: optStr(fd, "sourceRef"),
    indicatorCode: code && findIndicator(code) ? code : null,
    description: optStr(fd, "description"),
    ownerId: owner?.id ?? null,
    dueAt: dateOrNull(str(fd, "dueAt")),
    status,
    result: optStr(fd, "result"),
    closedAt: status === "DONE" || status === "CANCELLED" ? new Date() : null,
  };
  if (status === "DONE" && !data.result) return { error: "Indiquez le résultat obtenu : l'efficacité des actions est vérifiée en audit." };
  if (id) {
    await db.improvementAction.findFirstOrThrow({ where: { id, organizationId: orgId } });
    await db.improvementAction.update({ where: { id }, data });
  } else {
    const a = await db.improvementAction.create({ data: { ...data, organizationId: orgId, createdById: user.id } });
    if (a.ownerId && a.ownerId !== user.id) await notify(a.ownerId, "Action d'amélioration à mener", title, "/of/qualiopi/amelioration");
  }
  await audit(id ? "quality.action_update" : "quality.action_create", { actorId: user.id, organizationId: orgId, entityType: "ImprovementAction", entityId: id ?? undefined, details: { title, status } });
  refresh("/of/qualiopi/amelioration");
  return { ok: id ? "Action mise à jour." : "Action ajoutée au plan d'amélioration." };
}

export async function saveRiskAction(id: string | null, _: QState, fd: FormData): Promise<QState> {
  const { user, orgId } = await requireQuality();
  const title = str(fd, "title").slice(0, 200);
  if (!title) return { error: "Décrivez le risque." };
  const data = {
    title,
    process: optStr(fd, "process"),
    probability: clampInt(str(fd, "probability"), 1, 4, 2),
    impact: clampInt(str(fd, "impact"), 1, 4, 2),
    mitigation: optStr(fd, "mitigation"),
    ownerName: optStr(fd, "ownerName"),
    reviewedAt: new Date(),
  };
  if (id) {
    await db.qualityRisk.findFirstOrThrow({ where: { id, organizationId: orgId } });
    await db.qualityRisk.update({ where: { id }, data });
  } else await db.qualityRisk.create({ data: { ...data, organizationId: orgId } });
  await audit("quality.risk", { actorId: user.id, organizationId: orgId, details: title });
  refresh("/of/qualiopi/amelioration");
  return { ok: "Risque enregistré." };
}

export async function deleteRiskAction(id: string) {
  const { orgId } = await requireQuality();
  await db.qualityRisk.deleteMany({ where: { id, organizationId: orgId } });
  refresh("/of/qualiopi/amelioration");
}

// ─────────────── Audits et non-conformités ───────────────

export async function saveAuditAction(id: string | null, _: QState, fd: FormData): Promise<QState> {
  const { user, orgId } = await requireQuality();
  const type = str(fd, "type") in AUDIT_TYPES ? str(fd, "type") : "SURVEILLANCE";
  const scheduledAt = dateOrNull(str(fd, "scheduledAt"));
  if (!scheduledAt) return { error: "Date de l'audit requise." };
  const data = {
    type,
    scheduledAt,
    certifier: optStr(fd, "certifier"),
    auditor: optStr(fd, "auditor"),
    remote: bool(fd, "remote"),
    status: str(fd, "status") === "DONE" ? "DONE" : "PLANNED",
    result: ["CERTIFIED", "CERTIFIED_WITH_NC", "REFUSED"].includes(str(fd, "result")) ? str(fd, "result") : null,
    notes: optStr(fd, "notes"),
  };
  if (id) {
    await db.qualityAudit.findFirstOrThrow({ where: { id, organizationId: orgId } });
    await db.qualityAudit.update({ where: { id }, data });
  } else await db.qualityAudit.create({ data: { ...data, organizationId: orgId } });
  await audit("quality.audit", { actorId: user.id, organizationId: orgId, details: { type, scheduledAt } });
  refresh("/of/qualiopi/audits");
  return { ok: "Audit enregistré." };
}

/** Non-conformité : crée automatiquement l'action corrective correspondante dans le plan d'amélioration. */
export async function addNonConformityAction(auditId: string, _: QState, fd: FormData): Promise<QState> {
  const { user, orgId } = await requireQuality();
  const a = await db.qualityAudit.findFirstOrThrow({ where: { id: auditId, organizationId: orgId } });
  const code = str(fd, "indicatorCode");
  if (!findIndicator(code)) return { error: "Choisissez l'indicateur concerné." };
  const level = str(fd, "level") === "MAJOR" ? "MAJOR" : "MINOR";
  const description = str(fd, "description");
  if (!description) return { error: "Décrivez l'écart relevé." };
  // Délais réglementaires : 3 mois pour une majeure, 6 mois pour une mineure
  const dueAt = dateOrNull(str(fd, "dueAt")) ?? new Date(a.scheduledAt.getTime() + (level === "MAJOR" ? 90 : 180) * 86400_000);
  const action = await db.improvementAction.create({
    data: { organizationId: orgId, source: "AUDIT", sourceRef: auditId, indicatorCode: code, title: `Lever la non-conformité ${level === "MAJOR" ? "majeure" : "mineure"} (indicateur ${code})`, description, dueAt, createdById: user.id },
  });
  await db.nonConformity.create({ data: { organizationId: orgId, auditId, indicatorCode: code, level, description, dueAt, actionId: action.id } });
  await db.qualityIndicator.upsert({
    where: { organizationId_code: { organizationId: orgId, code } },
    create: { organizationId: orgId, code, status: "IN_PROGRESS" },
    update: { status: "IN_PROGRESS", validatedAt: null, validatedById: null },
  });
  await audit("quality.nc_create", { actorId: user.id, organizationId: orgId, entityType: "NonConformity", details: { code, level } });
  refresh("/of/qualiopi/audits", "/of/qualiopi/amelioration");
  return { ok: "Non-conformité enregistrée ; l'action corrective a été ajoutée au plan d'amélioration." };
}

export async function setNonConformityStatusAction(id: string, status: "OPEN" | "SUBMITTED" | "CLOSED") {
  const { user, orgId } = await requireQuality();
  await db.nonConformity.findFirstOrThrow({ where: { id, organizationId: orgId } });
  await db.nonConformity.update({ where: { id }, data: { status, closedAt: status === "CLOSED" ? new Date() : null } });
  await audit("quality.nc_status", { actorId: user.id, organizationId: orgId, entityType: "NonConformity", entityId: id, details: status });
  refresh("/of/qualiopi/audits");
}

// ─────────────── Veille ───────────────

export async function addWatchItemAction(_: QState, fd: FormData): Promise<QState> {
  const { user, orgId } = await requireQuality();
  const category = str(fd, "category");
  if (!(category in WATCH_CATEGORIES)) return { error: "Choisissez le type de veille." };
  const title = str(fd, "title").slice(0, 200);
  const summary = str(fd, "summary");
  if (!title || !summary) return { error: "Titre et résumé obligatoires." };
  const item = await db.watchItem.create({
    data: {
      organizationId: orgId, category, title, summary,
      source: optStr(fd, "source"), url: safeUrl(str(fd, "url")),
      impact: optStr(fd, "impact"), actions: optStr(fd, "actions"),
      publishedOn: dateOrNull(str(fd, "publishedOn")),
      shareWithTrainers: bool(fd, "shareWithTrainers"),
      createdById: user.id,
    },
  });
  if (item.shareWithTrainers) {
    const team = await db.user.findMany({ where: { organizationId: orgId, role: { in: ["TRAINER", "OF_ADMIN"] }, active: true, id: { not: user.id } }, select: { id: true } });
    for (const m of team) await notify(m.id, `Veille : ${title}`, "Nouvelle information à consulter et à confirmer.", "/of/veille");
  }
  await audit("quality.watch_add", { actorId: user.id, organizationId: orgId, entityType: "WatchItem", entityId: item.id, details: title });
  refresh("/of/qualiopi/veille", "/of/veille");
  return { ok: "Fiche de veille enregistrée." };
}

export async function deleteWatchItemAction(id: string) {
  const { orgId } = await requireQuality();
  await db.watchItem.deleteMany({ where: { id, organizationId: orgId } });
  refresh("/of/qualiopi/veille");
}

/** Accusé de lecture d'une fiche de veille par un membre de l'équipe (preuve de diffusion). */
export async function ackWatchItemAction(id: string) {
  const user = await requireStaff();
  const item = await db.watchItem.findFirstOrThrow({ where: { id, organizationId: user.organizationId ?? "__" } });
  await db.watchAck.upsert({ where: { itemId_userId: { itemId: item.id, userId: user.id } }, create: { itemId: item.id, userId: user.id }, update: {} });
  revalidatePath("/of/veille");
}

// ─────────────── Handicap ───────────────

/** Demande d'aménagement : par l'apprenant (depuis son espace) ou saisie par l'équipe. */
export async function requestAccommodationAction(_: QState, fd: FormData): Promise<QState> {
  const user = await requireUser();
  const need = str(fd, "need").slice(0, 3000);
  if (need.length < 5) return { error: "Décrivez votre besoin en quelques mots." };
  let learnerId = user.id;
  let orgId = user.organizationId;
  let requestedBy = "LEARNER";
  if (user.role !== "LEARNER") {
    if (!(await canManageQuality(user))) return { error: "Action non autorisée." };
    const l = await db.user.findFirst({ where: { id: str(fd, "userId"), organizationId: user.organizationId ?? "__", role: "LEARNER" }, select: { id: true } });
    if (!l) return { error: "Apprenant introuvable." };
    learnerId = l.id;
    requestedBy = "STAFF";
  }
  if (!orgId) return { error: "Aucun organisme rattaché." };
  const enrollmentId = str(fd, "enrollmentId");
  const enrollment = enrollmentId ? await db.enrollment.findFirst({ where: { id: enrollmentId, userId: learnerId, course: { organizationId: orgId } }, select: { id: true } }) : null;
  const acc = await db.accommodation.create({ data: { organizationId: orgId, userId: learnerId, enrollmentId: enrollment?.id ?? null, need, requestedBy } });
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { handicapReferentId: true } });
  const recipients = org?.handicapReferentId ? [org.handicapReferentId] : (await db.user.findMany({ where: { organizationId: orgId, role: "OF_ADMIN", active: true }, select: { id: true } })).map((u) => u.id);
  for (const r of recipients) if (r !== user.id) await notify(r, "Demande d'aménagement (handicap)", "Une demande d'aménagement a été enregistrée : à analyser.", "/of/qualiopi/handicap");
  await audit("accommodation.request", { actorId: user.id, organizationId: orgId, entityType: "Accommodation", entityId: acc.id });
  revalidatePath("/profile");
  refresh("/of/qualiopi/handicap");
  return { ok: requestedBy === "LEARNER" ? "Demande transmise au référent handicap, de façon confidentielle." : "Demande enregistrée au registre." };
}

export async function updateAccommodationAction(id: string, _: QState, fd: FormData): Promise<QState> {
  const { user, orgId } = await requireQuality();
  const acc = await db.accommodation.findFirstOrThrow({ where: { id, organizationId: orgId } });
  const status = ["REQUESTED", "ANALYSING", "IN_PLACE", "ORIENTED", "CLOSED"].includes(str(fd, "status")) ? str(fd, "status") : acc.status;
  const partners = fd.getAll("partners").map(String).filter(Boolean).slice(0, 10);
  await db.accommodation.update({
    where: { id },
    data: { status, measures: optStr(fd, "measures"), partners, handledById: user.id, decidedAt: status === "IN_PLACE" || status === "ORIENTED" ? new Date() : acc.decidedAt },
  });
  if (status !== acc.status && (status === "IN_PLACE" || status === "ORIENTED")) {
    await notify(acc.userId, "Votre demande d'aménagement", status === "IN_PLACE" ? "Des aménagements ont été mis en place pour votre formation." : "Votre demande a été orientée vers un partenaire spécialisé.", "/profile");
  }
  await audit("accommodation.update", { actorId: user.id, organizationId: orgId, entityType: "Accommodation", entityId: id, details: status });
  refresh("/of/qualiopi/handicap");
  return { ok: "Registre mis à jour." };
}

// ─────────────── Compétences des intervenants ───────────────

const QUALIF_KINDS = ["CV", "DIPLOMA", "CERTIFICATION", "EXPERIENCE", "TRAINING"];

/** Le formateur dépose ses justificatifs ; le référent qualité peut aussi en déposer pour un intervenant. */
export async function addQualificationAction(_: QState, fd: FormData): Promise<QState> {
  const user = await requireStaff();
  if (!user.organizationId) return { error: "Aucun organisme rattaché." };
  const manager = await canManageQuality(user);
  const targetId = manager && str(fd, "userId") ? str(fd, "userId") : user.id;
  const target = await db.user.findFirst({ where: { id: targetId, organizationId: user.organizationId, role: { in: ["TRAINER", "OF_ADMIN"] } }, select: { id: true } });
  if (!target) return { error: "Intervenant introuvable." };
  const kind = str(fd, "kind");
  if (!QUALIF_KINDS.includes(kind)) return { error: "Type de justificatif invalide." };
  const title = str(fd, "title").slice(0, 200);
  if (!title) return { error: "Intitulé requis." };
  const up = await readUpload(fd, { kind: "document", required: kind === "CV" });
  if ("error" in up) return up;
  const q = await db.trainerQualification.create({
    data: {
      userId: target.id, organizationId: user.organizationId, kind, title,
      issuer: optStr(fd, "issuer"), obtainedAt: dateOrNull(str(fd, "obtainedAt")), expiresAt: dateOrNull(str(fd, "expiresAt")),
      ...(up.file ?? {}),
      // Pièce déposée par le référent : validée d'office
      status: manager ? "VALIDATED" : "PENDING", validatedById: manager ? user.id : null, validatedAt: manager ? new Date() : null,
    },
  });
  await audit("quality.qualification_add", { actorId: user.id, organizationId: user.organizationId, entityType: "TrainerQualification", entityId: q.id, details: { kind, title } });
  revalidatePath("/of/competences");
  refresh("/of/qualiopi/formateurs");
  return { ok: manager ? "Justificatif enregistré et validé." : "Justificatif envoyé : le référent qualité va le vérifier." };
}

export async function reviewQualificationAction(id: string, decision: "VALIDATED" | "REJECTED") {
  const { user, orgId } = await requireQuality();
  const q = await db.trainerQualification.findFirstOrThrow({ where: { id, organizationId: orgId } });
  await db.trainerQualification.update({ where: { id }, data: { status: decision, validatedById: user.id, validatedAt: new Date() } });
  await notify(q.userId, decision === "VALIDATED" ? "Justificatif validé" : "Justificatif à revoir", q.title, "/of/competences");
  await audit("quality.qualification_review", { actorId: user.id, organizationId: orgId, entityType: "TrainerQualification", entityId: id, details: decision });
  refresh("/of/qualiopi/formateurs");
}

export async function deleteQualificationAction(id: string) {
  const user = await requireStaff();
  const q = await db.trainerQualification.findFirstOrThrow({ where: { id, organizationId: user.organizationId ?? "__" } });
  if (q.userId !== user.id && !(await canManageQuality(user))) throw new Error("Action non autorisée");
  await db.trainerQualification.delete({ where: { id } });
  revalidatePath("/of/competences");
  refresh("/of/qualiopi/formateurs");
}

// ─────────────── Sous-traitants ───────────────

export async function saveSubcontractorAction(id: string | null, _: QState, fd: FormData): Promise<QState> {
  const { user, orgId } = await requireQuality();
  const name = str(fd, "name").slice(0, 200);
  if (!name) return { error: "Nom requis." };
  const up = await readUpload(fd, { key: "contract", kind: "document", required: false });
  if ("error" in up) return up;
  const data = {
    name,
    siret: optStr(fd, "siret"),
    kind: ["SUBCONTRACTOR", "FREELANCE_TRAINER", "PORTAGE"].includes(str(fd, "kind")) ? str(fd, "kind") : "SUBCONTRACTOR",
    contactEmail: optStr(fd, "contactEmail"),
    qualiopiCertified: bool(fd, "qualiopiCertified"),
    qualiopiExpiresAt: dateOrNull(str(fd, "qualiopiExpiresAt")),
    contractSignedAt: dateOrNull(str(fd, "contractSignedAt")),
    lastEvaluationAt: dateOrNull(str(fd, "lastEvaluationAt")),
    evaluationNote: optStr(fd, "evaluationNote"),
    ...(up.file ? { contractFileName: up.file.fileName, contractFileType: up.file.fileType, contractSize: up.file.size, contractData: up.file.data } : {}),
  };
  if (id) {
    await db.subcontractor.findFirstOrThrow({ where: { id, organizationId: orgId } });
    await db.subcontractor.update({ where: { id }, data });
  } else await db.subcontractor.create({ data: { ...data, organizationId: orgId } });
  await audit("quality.subcontractor", { actorId: user.id, organizationId: orgId, details: name });
  refresh("/of/qualiopi/sous-traitants");
  return { ok: "Sous-traitant enregistré." };
}

export async function deleteSubcontractorAction(id: string) {
  const { orgId } = await requireQuality();
  await db.subcontractor.deleteMany({ where: { id, organizationId: orgId } });
  refresh("/of/qualiopi/sous-traitants");
}

// ─────────────── Indicateurs de résultats publiés ───────────────

export async function saveResultsPublicationAction(_: QState, fd: FormData): Promise<QState> {
  const { user, orgId } = await requireQuality();
  await db.organization.update({ where: { id: orgId }, data: { publishResults: bool(fd, "publishResults"), resultsNote: optStr(fd, "resultsNote") } });
  await audit("quality.results_publication", { actorId: user.id, organizationId: orgId, details: bool(fd, "publishResults") });
  refresh("/of/qualiopi/resultats");
  return { ok: bool(fd, "publishResults") ? "Indicateurs publiés." : "Publication désactivée." };
}

// ─────────────── Accès auditeur ───────────────

/** Lien de consultation en lecture seule du dossier de preuves, valable quelques jours. */
export async function createAuditorAccessAction(_: QState, fd: FormData): Promise<QState> {
  const { user, orgId } = await requireQuality();
  const days = clampInt(str(fd, "days"), 1, 30, 7);
  const token = randomBytes(24).toString("base64url");
  await db.auditorAccess.create({
    data: { organizationId: orgId, tokenHash: hashToken(token), label: str(fd, "label").slice(0, 120) || "Auditeur", expiresAt: new Date(Date.now() + days * 86400_000), createdById: user.id },
  });
  await audit("quality.auditor_access_create", { actorId: user.id, organizationId: orgId, details: { days } });
  const base = process.env.APP_URL || "";
  refresh("/of/qualiopi/dossier");
  return { ok: `Lien valable ${days} jour(s). Copiez-le maintenant : il ne sera plus affiché.`, link: `${base}/audit/${token}` };
}

export async function revokeAuditorAccessAction(id: string) {
  const { user, orgId } = await requireQuality();
  await db.auditorAccess.updateMany({ where: { id, organizationId: orgId }, data: { revokedAt: new Date() } });
  await audit("quality.auditor_access_revoke", { actorId: user.id, organizationId: orgId, entityId: id });
  refresh("/of/qualiopi/dossier");
}

/** Taux d'obtention d'une certification (indicateur 3), publié avec les indicateurs de résultats. */
export async function saveCertificationRateAction(courseId: string, _: QState, fd: FormData): Promise<QState> {
  const { user, orgId } = await requireQuality();
  await db.course.findFirstOrThrow({ where: { id: courseId, organizationId: orgId } });
  const rate = str(fd, "certSuccessRate") === "" ? null : Math.max(0, Math.min(100, Number(str(fd, "certSuccessRate").replace(",", "."))));
  const candidates = str(fd, "certCandidates") === "" ? null : Math.max(0, Math.round(Number(str(fd, "certCandidates"))));
  if ((rate !== null && Number.isNaN(rate)) || (candidates !== null && Number.isNaN(candidates))) return { error: "Valeurs numériques attendues." };
  await db.course.update({ where: { id: courseId }, data: { certSuccessRate: rate, certCandidates: candidates, certPeriod: optStr(fd, "certPeriod") } });
  await audit("quality.certification_rate", { actorId: user.id, organizationId: orgId, entityType: "Course", entityId: courseId, details: { rate, candidates } });
  refresh("/of/qualiopi/resultats");
  return { ok: "Taux enregistré." };
}
