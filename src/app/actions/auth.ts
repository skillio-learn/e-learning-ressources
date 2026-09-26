"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { MFA_COOKIE, SESSION_COOKIE, mfaCookieOptions, sessionCookieOptions, signMfaChallenge, signSession, verifyMfaChallenge, verifySession } from "@/lib/session";
import { consumeRecoveryCode, decryptSecret, verifyTotp } from "@/lib/totp";
import { audit } from "@/lib/audit";
import { getClientInfo } from "@/lib/request";
import { closeOpenSessions, startActivitySession } from "@/lib/tracking";

export type FormState = { error?: string; ok?: string } | undefined;

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

/** Redirection après connexion : chemin interne uniquement (pas de « //hôte », « /\hôte » ni caractère de contrôle). */
function safeNext(next: FormDataEntryValue | null, role?: string) {
  const fallback = role === "ADMIN" ? "/admin" : role === "COMPANY" ? "/entreprise" : "/dashboard";
  const n = typeof next === "string" ? next : "";
  if (!n.startsWith("/") || n.startsWith("//") || /[\\\u0000-\u001f]/.test(n)) return fallback;
  try {
    const u = new URL(n, "http://vylia.local");
    return u.origin === "http://vylia.local" ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
}

// Empreinte factice : le temps de réponse est le même que le compte existe ou non (pas d'énumération par chronométrage)
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.hTxGSEZlp0M2Il9xAzxm9ZaMpQfO";
const WINDOW_MS = LOCK_MINUTES * 60_000;
const GENERIC_FAIL = "Email ou mot de passe incorrect. Après plusieurs échecs, la connexion est suspendue quelques minutes.";

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  const { ip, userAgent } = await getClientInfo();
  const since = new Date(Date.now() - WINDOW_MS);

  // Limitation : par adresse IP (attaques par dictionnaire) et par compte depuis cette IP (verrouillage ciblé)
  const [ipFails, accountFailsFromIp, accountFails] = await Promise.all([
    ip ? db.loginEvent.count({ where: { ip, type: { in: ["FAILED", "LOCKED"] }, createdAt: { gte: since } } }) : Promise.resolve(0),
    db.loginEvent.count({ where: { email, ip, type: { in: ["FAILED", "LOCKED"] }, createdAt: { gte: since } } }),
    db.loginEvent.count({ where: { email, type: "FAILED", createdAt: { gte: since } } }),
  ]);
  if (ipFails >= 30 || accountFailsFromIp >= MAX_FAILED || accountFails >= 50) {
    const u = await db.user.findUnique({ where: { email }, select: { id: true } });
    await db.loginEvent.create({ data: { userId: u?.id ?? null, email, type: "LOCKED", ip, userAgent } });
    return { error: `Trop de tentatives : réessayez dans ${LOCK_MINUTES} minutes ou utilisez « Mot de passe oublié ».` };
  }

  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) {
    await db.loginEvent.create({ data: { userId: user?.id ?? null, email, type: "FAILED", ip, userAgent } });
    return { error: GENERIC_FAIL };
  }
  const org = user.organizationId ? await db.organization.findUnique({ where: { id: user.organizationId }, select: { active: true } }) : null;
  if (user.role !== "ADMIN" && org && !org.active) return { error: "L'accès de votre organisme à la plateforme est suspendu." };

  const next = safeNext(fd.get("next"), user.role);
  // Double authentification activée : le mot de passe seul n'ouvre pas de session
  if (user.totpEnabledAt && user.totpSecret) {
    const challenge = await signMfaChallenge({ uid: user.id, sv: user.sessionVersion, next });
    (await cookies()).set(MFA_COOKIE, challenge, mfaCookieOptions);
    redirect("/login/2fa");
  }
  await openSession(user, ip, userAgent);
  redirect(next);
}

async function openSession(
  user: { id: string; email: string; role: import("@prisma/client").Role; name: string; sessionVersion: number },
  ip: string | null,
  userAgent: string | null,
) {
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null } });
  await db.loginEvent.create({ data: { userId: user.id, email: user.email, type: "LOGIN", ip, userAgent } });
  await startActivitySession(user.id, ip, userAgent);
  const token = await signSession({ uid: user.id, role: user.role, name: user.name, sv: user.sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

/** Deuxième étape de connexion : code de l'application d'authentification ou code de secours. */
export async function verifyMfaLoginAction(_: FormState, fd: FormData): Promise<FormState> {
  const store = await cookies();
  const challenge = await verifyMfaChallenge(store.get(MFA_COOKIE)?.value);
  if (!challenge) return { error: "Délai dépassé : reconnectez-vous avec votre mot de passe." };
  const { ip, userAgent } = await getClientInfo();
  const user = await db.user.findUnique({ where: { id: challenge.uid } });
  if (!user || !user.active || user.sessionVersion !== challenge.sv || !user.totpSecret || !user.totpEnabledAt) {
    store.delete(MFA_COOKIE);
    return { error: "Session expirée : reconnectez-vous." };
  }
  const since = new Date(Date.now() - WINDOW_MS);
  const fails = await db.loginEvent.count({ where: { userId: user.id, type: "FAILED", createdAt: { gte: since } } });
  if (fails >= MAX_FAILED) {
    store.delete(MFA_COOKIE);
    return { error: `Trop de codes erronés : réessayez dans ${LOCK_MINUTES} minutes.` };
  }
  const code = String(fd.get("code") ?? "").trim().slice(0, 20);
  let ok = verifyTotp(decryptSecret(user.totpSecret), code);
  if (!ok && code.length > 6) {
    const remaining = consumeRecoveryCode(user.totpRecoveryHashes, code);
    if (remaining) {
      ok = true;
      await db.user.update({ where: { id: user.id }, data: { totpRecoveryHashes: remaining } });
      await audit("user.mfa_recovery_used", { actorId: user.id, organizationId: user.organizationId, entityType: "User", entityId: user.id, details: `${remaining.length} code(s) restant(s)` });
    }
  }
  if (!ok) {
    await db.loginEvent.create({ data: { userId: user.id, email: user.email, type: "FAILED", ip, userAgent } });
    return { error: "Code incorrect." };
  }
  store.delete(MFA_COOKIE);
  await openSession(user, ip, userAgent);
  redirect(challenge.next);
}

export async function logoutAction() {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (session) {
    const { ip, userAgent } = await getClientInfo();
    const user = await db.user.findUnique({ where: { id: session.uid }, select: { email: true } });
    await db.loginEvent.create({ data: { userId: session.uid, email: user?.email ?? "", type: "LOGOUT", ip, userAgent } });
    await closeOpenSessions(session.uid);
  }
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
