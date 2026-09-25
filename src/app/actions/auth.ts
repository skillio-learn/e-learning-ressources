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

function safeNext(next: FormDataEntryValue | null, role?: string) {
  const n = typeof next === "string" ? next : "";
  if (n.startsWith("/") && !n.startsWith("//")) return n;
  return role === "ADMIN" ? "/admin" : "/dashboard";
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const { ip, userAgent } = await getClientInfo();
  const user = await db.user.findUnique({ where: { email } });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await db.loginEvent.create({ data: { userId: user.id, email, type: "LOCKED", ip, userAgent } });
    const min = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Compte temporairement verrouillé suite à plusieurs échecs. Réessayez dans ${min} min.` };
  }

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await db.loginEvent.create({ data: { userId: user?.id ?? null, email, type: "FAILED", ip, userAgent } });
    if (user) {
      const failed = user.failedLogins + 1;
      await db.user.update({
        where: { id: user.id },
        data: failed >= MAX_FAILED ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) } : { failedLogins: failed },
      });
      if (failed >= MAX_FAILED) return { error: `Trop d'échecs : compte verrouillé pendant ${LOCK_MINUTES} minutes.` };
    }
    return { error: "Email ou mot de passe incorrect." };
  }
  if (!user.active) return { error: "Ce compte est désactivé. Contactez votre organisme de formation." };

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null } });
  await db.loginEvent.create({ data: { userId: user.id, email, type: "LOGIN", ip, userAgent } });
  await startActivitySession(user.id, ip, userAgent);
  const token = await signSession({ uid: user.id, role: user.role, name: user.name });
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
