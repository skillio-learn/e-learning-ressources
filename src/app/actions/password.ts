"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { emailEnabled, sendEmail } from "@/lib/email";
import { notifyOrgManagers } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { requireOfManager } from "@/lib/auth";
import { canManageOrg } from "@/lib/permissions";
import { randomCode, str } from "@/lib/utils";

export type PwState = { error?: string; ok?: string } | undefined;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Demande de réinitialisation : réponse identique que le compte existe ou non (pas d'énumération). */
export async function requestPasswordResetAction(_: PwState, fd: FormData): Promise<PwState> {
  const email = str(fd, "email").toLowerCase();
  const generic = emailEnabled()
    ? "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé (valable 1 heure)."
    : "Votre demande a été transmise à votre organisme de formation, qui vous communiquera un nouveau mot de passe.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Email invalide." };
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active) return { ok: generic };
  const recent = await db.passwordResetToken.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 10 * 60000) } } });
  if (recent >= 3) return { ok: generic };
  if (emailEnabled()) {
    const token = randomBytes(32).toString("hex");
    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 3600_000) } });
    await sendEmail(
      user.email,
      "Réinitialisation de votre mot de passe",
      "Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
      `/reset-password/${token}`,
    );
  } else if (user.organizationId) {
    await notifyOrgManagers(user.organizationId, "Demande de réinitialisation de mot de passe", `${user.name} (${user.email}) a oublié son mot de passe.`, `/of/learners/${user.id}`);
  }
  await audit("user.password_reset_request", { actorId: user.id, organizationId: user.organizationId, entityType: "User", entityId: user.id });
  return { ok: generic };
}

export async function resetPasswordWithTokenAction(token: string, _: PwState, fd: FormData): Promise<PwState> {
  const password = String(fd.get("password") ?? "");
  if (password.length < 8 || !/[0-9]/.test(password) || !/[A-Za-z]/.test(password)) {
    return { error: "8 caractères minimum, dont une lettre et un chiffre." };
  }
  if (password !== String(fd.get("confirm") ?? "")) return { error: "Les deux mots de passe ne correspondent pas." };
  const rec = await db.passwordResetToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) return { error: "Lien invalide ou expiré. Refaites une demande." };
  await db.$transaction([
    db.user.update({ where: { id: rec.userId }, data: { passwordHash: await bcrypt.hash(password, 10), failedLogins: 0, lockedUntil: null } }),
    db.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
  ]);
  await audit("user.password_reset", { actorId: rec.userId, entityType: "User", entityId: rec.userId, details: "par lien email" });
  return { ok: "Mot de passe modifié. Vous pouvez vous connecter." };
}

/** Réinitialisation par l'OF d'un mot de passe d'apprenant (génère un mot de passe provisoire). */
export async function ofResetLearnerPasswordAction(learnerId: string, _: PwState): Promise<PwState> {
  const user = await requireOfManager();
  const learner = await db.user.findUnique({ where: { id: learnerId } });
  if (!learner || learner.role !== "LEARNER") return { error: "Apprenant introuvable." };
  const orgIds = await db.enrollment.findMany({ where: { userId: learnerId }, select: { course: { select: { organizationId: true } } } });
  const apps = await db.application.findMany({ where: { userId: learnerId }, select: { course: { select: { organizationId: true } } } });
  const allowed = [learner.organizationId, ...orgIds.map((o) => o.course.organizationId), ...apps.map((a) => a.course.organizationId)].some((o) => canManageOrg(user, o));
  if (!allowed) return { error: "Accès refusé." };
  const password = randomCode(10) + "7";
  await db.user.update({ where: { id: learnerId }, data: { passwordHash: await bcrypt.hash(password, 10), failedLogins: 0, lockedUntil: null } });
  await audit("user.password_reset", { actorId: user.id, organizationId: user.organizationId, entityType: "User", entityId: learnerId });
  await sendEmail(learner.email, "Nouveau mot de passe provisoire", `Votre organisme de formation a réinitialisé votre mot de passe. Mot de passe provisoire : ${password}\nPensez à le modifier dans « Mon profil ».`, "/login");
  return { ok: `Mot de passe provisoire : ${password} (compte déverrouillé)` };
}
