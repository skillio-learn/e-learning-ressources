"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "@/lib/session";
import { getClientInfo } from "@/lib/request";
import { closeOpenSessions, startActivitySession } from "@/lib/tracking";

export type FormState = { error?: string; ok?: string } | undefined;

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

/** Redirection après connexion : chemin interne uniquement (pas de « //hôte », « /\hôte » ni caractère de contrôle). */
function safeNext(next: FormDataEntryValue | null, role?: string) {
  const fallback = role === "ADMIN" ? "/admin" : "/dashboard";
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

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null } });
  await db.loginEvent.create({ data: { userId: user.id, email, type: "LOGIN", ip, userAgent } });
  await startActivitySession(user.id, ip, userAgent);
  const token = await signSession({ uid: user.id, role: user.role, name: user.name, sv: user.sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect(safeNext(fd.get("next"), user.role));
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
