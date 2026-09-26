import "server-only";
import { createHmac, randomBytes } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { db } from "./db";
import { decryptSecret, encryptSecret } from "./totp";

/** Événements diffusés aux webhooks (Make, Zapier, n8n…) : action du journal d'audit → nom public. */
export const WEBHOOK_EVENTS: Record<string, { event: string; label: string }> = {
  "application.submit": { event: "application.submitted", label: "Dossier de candidature déposé" },
  "enrollment.create": { event: "enrollment.created", label: "Inscription créée" },
  "access.grant": { event: "enrollment.access_granted", label: "Accès au parcours ouvert" },
  "enrollment.completed": { event: "enrollment.completed", label: "Formation terminée" },
  "enrollment.status": { event: "enrollment.status_changed", label: "Statut d'inscription modifié (abandon, suspension…)" },
  "session.create": { event: "session.created", label: "Session créée" },
  "company.convention_sign": { event: "company.convention_signed", label: "Convention signée par une entreprise" },
  "absence.alert": { event: "absence.alert", label: "Alerte d'absences" },
  "complaint.update": { event: "complaint.updated", label: "Réclamation mise à jour" },
};

export const newWebhookSecret = () => `whsec_${randomBytes(24).toString("base64url")}`;
export const storeSecret = (s: string) => encryptSecret(s);

/** Refuse les adresses internes (SSRF) : localhost, réseaux privés, lien local, métadonnées cloud. */
function privateIp(ip: string) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    if (v.startsWith("::ffff:")) return privateIp(v.slice(7));
    return false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export async function assertPublicUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Adresse invalide.");
  }
  if (u.protocol !== "https:") throw new Error("L'adresse doit commencer par https://");
  if (u.username || u.password) throw new Error("Adresse invalide.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (!ips.length) throw new Error("Nom de domaine introuvable.");
  if (ips.some(privateIp)) throw new Error("Adresse interne refusée.");
  return u;
}

/** Envoi signé : en-tête X-Vylia-Signature = sha256=HMAC(secret, horodatage.corps). */
export async function deliver(hook: { id: string; url: string; secret: string }, event: string, data: unknown) {
  const body = JSON.stringify({ id: randomBytes(12).toString("hex"), event, createdAt: new Date().toISOString(), data });
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = createHmac("sha256", decryptSecret(hook.secret)).update(`${ts}.${body}`).digest("hex");
  let status: number | null = null;
  let error: string | null = null;
  try {
    await assertPublicUrl(hook.url);
    const res = await fetch(hook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Vylia-Webhooks/1.0", "X-Vylia-Event": event, "X-Vylia-Timestamp": ts, "X-Vylia-Signature": `sha256=${sig}` },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    status = res.status;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 200) : "Échec de l'envoi";
  }
  await db.webhook.update({ where: { id: hook.id }, data: { lastStatus: status, lastError: error, lastAt: new Date() } }).catch(() => {});
  return { status, error };
}

/** Diffuse un événement du journal d'audit aux webhooks actifs de l'organisme abonnés à cet événement. */
export async function fireWebhooks(action: string, organizationId: string, payload: { entityType?: string; entityId?: string; details?: unknown }) {
  const def = WEBHOOK_EVENTS[action];
  if (!def) return;
  const hooks = await db.webhook.findMany({ where: { organizationId, active: true, events: { has: def.event } } });
  await Promise.all(hooks.map((h) => deliver(h, def.event, { organizationId, entityType: payload.entityType ?? null, entityId: payload.entityId ?? null, details: payload.details ?? null })));
}
