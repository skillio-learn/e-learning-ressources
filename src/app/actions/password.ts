"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { appUrl, emailEnabled, sendTemplatedEmail } from "@/lib/email";
import { notifyOrgManagers } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { requireOfManager } from "@/lib/auth";
import { str } from "@/lib/utils";

export type PwState = { error?: string; ok?: string } | undefined;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

async function newResetToken(userId: string, ttlMs: number) {
  // Un seul lien valable à la fois : les précédents sont invalidés
  await db.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  const token = randomBytes(32).toString("hex");
  await db.passwordResetToken.create({ data: { userId, tokenHash: hash(token), expiresAt: new Date(Date.now() + ttlMs) } });
  return `/reset-password/${token}`;
}

async function emailContext(userId: string) {
  const u = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true, role: true, profile: { select: { firstName: true } }, organization: { select: { name: true, email: true } } },
  });
  const org = u.role === "ADMIN" ? null : u.organization;
  return { email: u.email, first: u.profile?.firstName ?? u.name.split(" ")[0], orgName: org?.name ?? null, replyTo: org?.email ?? null };
}

/** Demande de réinitialisation : réponse identique que le compte existe ou non (pas d'énumération). */
export async function requestPasswordResetAction(_: PwState, fd: FormData): Promise<PwState> {
  const email = str(fd, "email").toLowerCase().slice(0, 200);
  const generic = emailEnabled()
    ? "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé (valable 1 heure)."
    : "Votre demande a été transmise à votre organisme de formation, qui vous recontactera.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Email invalide." };
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active) return { ok: generic };
  const recent = await db.passwordResetToken.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 10 * 60000) } } });
  if (recent >= 3) return { ok: generic };
  if (emailEnabled()) {
    const link = await newResetToken(user.id, 3600_000);
    const ctx = await emailContext(user.id);
    await sendTemplatedEmail(
      ctx.email,
      "Réinitialisez votre mot de passe",
      {
        title: "Réinitialisez votre mot de passe",
        preheader: "Lien valable 1 heure.",
        paragraphs: [`Bonjour ${ctx.first},`, "Vous avez demandé à réinitialiser le mot de passe de votre compte Vylia. Choisissez-en un nouveau avec le bouton ci-dessous."],
        cta: { url: link, label: "Choisir un nouveau mot de passe" },
        note: "Ce lien est valable 1 heure et ne peut servir qu'une fois. Vous n'êtes pas à l'origine de cette demande ? Ignorez ce message : votre mot de passe reste inchangé.",
      },
      { orgName: ctx.orgName, replyTo: ctx.replyTo, tag: "password_reset" },
    );
  } else if (user.organizationId) {
    await notifyOrgManagers(user.organizationId, "Demande de réinitialisation de mot de passe", `${user.name} (${user.email}) a oublié son mot de passe.`, `/of/learners/${user.id}`);
  }
  await audit("user.password_reset_request", { actorId: user.id, organizationId: user.organizationId, entityType: "User", entityId: user.id });
  return { ok: generic };
}

export async function resetPasswordWithTokenAction(token: string, _: PwState, fd: FormData): Promise<PwState> {
  const password = String(fd.get("password") ?? "");
  if (password.length < 8 || password.length > 200 || !/[0-9]/.test(password) || !/[A-Za-z]/.test(password)) {
    return { error: "8 caractères minimum, dont une lettre et un chiffre." };
  }
  if (password !== String(fd.get("confirm") ?? "")) return { error: "Les deux mots de passe ne correspondent pas." };
  const rec = await db.passwordResetToken.findUnique({ where: { tokenHash: hash(String(token).slice(0, 128)) } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) return { error: "Lien invalide ou expiré. Refaites une demande." };
  // Consommation atomique : un lien ne sert qu'une fois, même en cas de double envoi
  const consumed = await db.passwordResetToken.updateMany({ where: { id: rec.id, usedAt: null }, data: { usedAt: new Date() } });
  if (consumed.count !== 1) return { error: "Lien invalide ou expiré. Refaites une demande." };
  await db.$transaction([
    db.user.update({
      where: { id: rec.userId },
      data: { passwordHash: await bcrypt.hash(password, 10), failedLogins: 0, lockedUntil: null, sessionVersion: { increment: 1 } },
    }),
    db.passwordResetToken.updateMany({ where: { userId: rec.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  await audit("user.password_reset", { actorId: rec.userId, entityType: "User", entityId: rec.userId, details: "par lien email" });
  return { ok: "Mot de passe modifié. Vous pouvez vous connecter." };
}

/**
 * Réinitialisation demandée par l'OF pour un de ses apprenants : l'apprenant reçoit un lien personnel par email.
 * L'OF ne voit jamais le mot de passe (sauf si l'envoi d'emails n'est pas configuré : le lien lui est alors affiché).
 */
export async function ofResetLearnerPasswordAction(learnerId: string, _: PwState): Promise<PwState> {
  const staff = await requireOfManager();
  const learner = await db.user.findUnique({ where: { id: learnerId }, select: { id: true, role: true, organizationId: true, email: true } });
  if (!learner || learner.role !== "LEARNER") return { error: "Apprenant introuvable." };
  // Seul l'organisme de rattachement de l'apprenant peut agir sur son compte
  if (!learner.organizationId || staff.role !== "OF_ADMIN" || staff.organizationId !== learner.organizationId) return { error: "Accès refusé." };
  const link = await newResetToken(learner.id, 24 * 3600_000);
  await db.user.update({ where: { id: learner.id }, data: { failedLogins: 0, lockedUntil: null, sessionVersion: { increment: 1 } } });
  await audit("user.password_reset", { actorId: staff.id, organizationId: learner.organizationId, entityType: "User", entityId: learner.id, details: "lien envoyé par l'OF" });
  if (!emailEnabled()) return { ok: `Envoi d'emails non configuré : transmettez ce lien personnel à l'apprenant (24 h) : ${appUrl(link)}` };
  const ctx = await emailContext(learner.id);
  await sendTemplatedEmail(
    ctx.email,
    "Choisissez un nouveau mot de passe",
    {
      title: "Choisissez un nouveau mot de passe",
      paragraphs: [`Bonjour ${ctx.first},`, `${ctx.orgName ?? "Votre organisme de formation"} a réinitialisé l'accès à votre compte. Choisissez un nouveau mot de passe pour vous reconnecter.`],
      cta: { url: link, label: "Choisir mon mot de passe" },
      note: "Lien personnel, valable 24 heures et utilisable une seule fois.",
    },
    { orgName: ctx.orgName, replyTo: ctx.replyTo, tag: "password_reset" },
  );
  return { ok: "Un lien de réinitialisation a été envoyé à l'apprenant (valable 24 h). Ses sessions ouvertes ont été fermées." };
}
