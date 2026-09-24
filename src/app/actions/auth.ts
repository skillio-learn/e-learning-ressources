"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getClientInfo } from "@/lib/request";
import { closeOpenSessions, startActivitySession } from "@/lib/tracking";
import { audit } from "@/lib/audit";

export type FormState = { error?: string; ok?: string } | undefined;

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
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
  redirect(safeNext(fd.get("next")));
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court"),
  email: z.string().trim().toLowerCase().email("Email invalide"),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre")
    .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre"),
});

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  const settings = await getSettings();
  if (settings.allowRegistration !== "true") return { error: "Les inscriptions sont fermées." };
  const parsed = registerSchema.safeParse({ name: fd.get("name"), email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (fd.get("consent") !== "on") return { error: "Vous devez accepter les CGU et la politique de confidentialité." };
  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "Un compte existe déjà avec cet email." };

  const orgSlug = String(fd.get("of") ?? "");
  const org = orgSlug ? await db.organization.findUnique({ where: { slug: orgSlug }, select: { id: true, active: true } }) : null;
  const { ip, userAgent } = await getClientInfo();
  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "LEARNER",
      lastLoginAt: new Date(),
      consentAt: new Date(),
      organizationId: org?.active ? org.id : null,
    },
  });
  await db.loginEvent.create({ data: { userId: user.id, email, type: "LOGIN", ip, userAgent } });
  await startActivitySession(user.id, ip, userAgent);
  await audit("auth.register", { actorId: user.id, organizationId: user.organizationId, entityType: "User", entityId: user.id });
  const token = await signSession({ uid: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect(safeNext(fd.get("next")));
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
