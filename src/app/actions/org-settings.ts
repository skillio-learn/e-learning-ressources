"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { internalRulesTemplate } from "@/lib/terms";
import { WEBHOOK_EVENTS, assertPublicUrl, deliver, newWebhookSecret, storeSecret } from "@/lib/webhooks";
import { bool, optInt, optStr, str } from "@/lib/utils";

export type OState = { error?: string; ok?: string } | undefined;

async function managerOrg() {
  const user = await requireOfManager();
  if (!user.organizationId) throw new Error("Aucun organisme rattaché");
  return { user, orgId: user.organizationId };
}

/** Sécurité de l'équipe (2FA obligatoire) et suivi des absences. */
export async function saveOrgPoliciesAction(_: OState, fd: FormData): Promise<OState> {
  const { user, orgId } = await managerOrg();
  const threshold = optInt(fd, "absenceAlertThreshold") ?? 2;
  if (threshold < 0 || threshold > 20) return { error: "Seuil d'alerte : entre 0 (désactivé) et 20 demi-journées." };
  const mfaRequired = bool(fd, "mfaRequired");
  if (mfaRequired && !user.mfaEnabled) return { error: "Activez d'abord la double authentification sur votre propre compte (Profil, Sécurité)." };
  await db.organization.update({ where: { id: orgId }, data: { mfaRequired, absenceAlertThreshold: threshold, notifyEmployerOnAbsence: bool(fd, "notifyEmployerOnAbsence") } });
  await audit("settings.update", { actorId: user.id, organizationId: orgId, entityType: "Organization", entityId: orgId, details: { mfaRequired, threshold } });
  revalidatePath("/of/settings");
  return { ok: "Paramètres enregistrés." };
}

/** Pré-remplit le règlement intérieur des stagiaires à partir du modèle Vylia (à relire et adapter). */
export async function generateInternalRulesAction() {
  const { user, orgId } = await managerOrg();
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  await db.organization.update({ where: { id: orgId }, data: { internalRulesText: internalRulesTemplate(org) } });
  await audit("settings.update", { actorId: user.id, organizationId: orgId, entityType: "Organization", entityId: orgId, details: { internalRules: "modèle" } });
  revalidatePath("/of/settings");
}

// ─────────────── Webhooks (Make, Zapier, n8n…) ───────────────

export async function createWebhookAction(_: OState, fd: FormData): Promise<OState> {
  const { user, orgId } = await managerOrg();
  const url = str(fd, "url");
  try {
    await assertPublicUrl(url);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const known = new Set(Object.values(WEBHOOK_EVENTS).map((e) => e.event));
  const events = fd.getAll("events").map(String).filter((e) => known.has(e));
  if (!events.length) return { error: "Choisissez au moins un événement." };
  if ((await db.webhook.count({ where: { organizationId: orgId } })) >= 10) return { error: "10 webhooks maximum par organisme." };
  const secret = newWebhookSecret();
  await db.webhook.create({ data: { organizationId: orgId, url: url.slice(0, 500), secret: storeSecret(secret), events, description: optStr(fd, "description")?.slice(0, 120) ?? null } });
  await audit("settings.update", { actorId: user.id, organizationId: orgId, details: { webhook: "création" } });
  revalidatePath("/of/settings");
  return { ok: `Webhook créé. Clé de signature (affichée une seule fois, à copier dans Make ou Zapier pour vérifier l'en-tête X-Vylia-Signature) : ${secret}` };
}

export async function deleteWebhookAction(id: string) {
  const { user, orgId } = await managerOrg();
  await db.webhook.deleteMany({ where: { id, organizationId: orgId } });
  await audit("settings.update", { actorId: user.id, organizationId: orgId, details: { webhook: "suppression" } });
  revalidatePath("/of/settings");
}

export async function toggleWebhookAction(id: string) {
  const { orgId } = await managerOrg();
  const h = await db.webhook.findFirstOrThrow({ where: { id, organizationId: orgId } });
  await db.webhook.update({ where: { id }, data: { active: !h.active } });
  revalidatePath("/of/settings");
}

export async function testWebhookAction(id: string) {
  const { orgId } = await managerOrg();
  const h = await db.webhook.findFirstOrThrow({ where: { id, organizationId: orgId } });
  await deliver(h, "ping", { organizationId: orgId, message: "Test de connexion depuis Vylia" });
  revalidatePath("/of/settings");
}
