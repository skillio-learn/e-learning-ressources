"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { decryptSecret, encryptSecret, generateRecoveryCodes, generateTotpSecret, verifyTotp } from "@/lib/totp";

export type MfaState = { error?: string; ok?: string; codes?: string[] } | undefined;

/** Prépare l'activation : nouveau secret (non actif tant que le premier code n'est pas confirmé). */
export async function startMfaSetupAction() {
  const user = await requireUser();
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpEnabledAt: true } });
  if (u.totpEnabledAt) throw new Error("La double authentification est déjà active.");
  await db.user.update({ where: { id: user.id }, data: { totpSecret: encryptSecret(generateTotpSecret()) } });
  revalidatePath("/profile/security");
}

/** Active la double authentification après vérification d'un premier code ; renvoie les codes de secours (affichés une fois). */
export async function confirmMfaSetupAction(_: MfaState, fd: FormData): Promise<MfaState> {
  const user = await requireUser();
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpSecret: true, totpEnabledAt: true } });
  if (u.totpEnabledAt) return { error: "Déjà activée." };
  if (!u.totpSecret) return { error: "Commencez par générer le QR code." };
  if (!verifyTotp(decryptSecret(u.totpSecret), String(fd.get("code") ?? ""))) return { error: "Code incorrect : vérifiez l'heure de votre téléphone et réessayez." };
  const { codes, hashes } = generateRecoveryCodes();
  await db.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date(), totpRecoveryHashes: hashes } });
  await audit("user.mfa_enable", { actorId: user.id, organizationId: user.organizationId, entityType: "User", entityId: user.id });
  revalidatePath("/profile/security");
  return { ok: "Double authentification activée.", codes };
}

/** Désactive la double authentification (mot de passe + code exigés) ; impossible si l'OF l'impose. */
export async function disableMfaAction(_: MfaState, fd: FormData): Promise<MfaState> {
  const user = await requireUser();
  if (user.mfaRequired) return { error: "Votre organisme impose la double authentification : elle ne peut pas être désactivée." };
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true, totpSecret: true } });
  if (!(await bcrypt.compare(String(fd.get("password") ?? ""), u.passwordHash))) return { error: "Mot de passe incorrect." };
  if (!u.totpSecret || !verifyTotp(decryptSecret(u.totpSecret), String(fd.get("code") ?? ""))) return { error: "Code incorrect." };
  await db.user.update({ where: { id: user.id }, data: { totpSecret: null, totpEnabledAt: null, totpRecoveryHashes: [] } });
  await audit("user.mfa_disable", { actorId: user.id, organizationId: user.organizationId, entityType: "User", entityId: user.id });
  revalidatePath("/profile/security");
  return { ok: "Double authentification désactivée." };
}

/** Nouveaux codes de secours (les anciens deviennent invalides). */
export async function regenerateRecoveryCodesAction(_: MfaState, fd: FormData): Promise<MfaState> {
  const user = await requireUser();
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpSecret: true, totpEnabledAt: true } });
  if (!u.totpEnabledAt || !u.totpSecret) return { error: "Double authentification inactive." };
  if (!verifyTotp(decryptSecret(u.totpSecret), String(fd.get("code") ?? ""))) return { error: "Code incorrect." };
  const { codes, hashes } = generateRecoveryCodes();
  await db.user.update({ where: { id: user.id }, data: { totpRecoveryHashes: hashes } });
  await audit("user.mfa_recovery_regenerate", { actorId: user.id, organizationId: user.organizationId, entityType: "User", entityId: user.id });
  return { ok: "Nouveaux codes générés : conservez-les en lieu sûr.", codes };
}

/**
 * Réinitialisation par un tiers habilité (téléphone perdu, codes épuisés) :
 * le responsable OF pour les membres et apprenants de son organisme, l'administrateur Vylia pour les responsables OF.
 * Les sessions ouvertes de la personne sont révoquées.
 */
export async function resetUserMfaAction(userId: string) {
  const actor = await requireUser();
  const target = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, role: true, organizationId: true } });
  const allowed =
    (actor.role === "ADMIN" && target.role !== "ADMIN") ||
    (actor.role === "OF_ADMIN" && !!actor.organizationId && target.organizationId === actor.organizationId && target.role !== "OF_ADMIN" && target.id !== actor.id);
  if (!allowed) throw new Error("Action non autorisée");
  await db.user.update({
    where: { id: target.id },
    data: { totpSecret: null, totpEnabledAt: null, totpRecoveryHashes: [], sessionVersion: { increment: 1 } },
  });
  await audit("user.mfa_reset", { actorId: actor.id, organizationId: target.organizationId, entityType: "User", entityId: target.id });
  revalidatePath("/of/team");
  revalidatePath("/admin/users");
}
