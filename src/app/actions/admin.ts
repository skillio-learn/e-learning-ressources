"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { randomCode, slugify, str } from "@/lib/utils";
import { audit } from "@/lib/audit";
import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { inviteStaffMember } from "@/lib/passwords";

const ROLES: Role[] = ["ADMIN", "OF_ADMIN", "TRAINER", "LEARNER"];

export type AdminState = { error?: string; ok?: string } | undefined;

export async function createUserAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireRole("ADMIN");
  const email = str(fd, "email").toLowerCase();
  const name = str(fd, "name");
  const role = str(fd, "role") as Role;
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Nom et email valides requis." };
  if (!ROLES.includes(role)) return { error: "Rôle invalide." };
  if (await db.user.findUnique({ where: { email } })) return { error: "Un compte existe déjà avec cet email." };
  const organizationId = str(fd, "organizationId") || null;
  if ((role === "OF_ADMIN" || role === "TRAINER") && !organizationId) return { error: "Choisissez l'organisme de rattachement." };
  if (organizationId && !(await db.organization.findUnique({ where: { id: organizationId }, select: { id: true } }))) return { error: "Organisme introuvable." };
  const created = await db.user.create({
    data: {
      // Mot de passe inutilisable : la personne choisit le sien via le lien d'invitation
      email, name: name.slice(0, 120), role, organizationId: role === "ADMIN" ? null : organizationId, passwordHash: await bcrypt.hash(randomCode(24), 10), createdVia: "ADMIN",
      // Un apprenant complète son dossier administratif, validé ensuite par son OF
      ...(role === "LEARNER" ? { accountStatus: "PENDING_PROFILE" as const } : {}),
    },
  });
  await audit("user.create", { actorId: admin.id, organizationId, entityType: "User", entityId: created.id, details: { role } });
  const link = await inviteStaffMember(created.id, admin.name);
  revalidatePath("/admin/users");
  return { ok: link ? `Compte créé. Transmettez ce lien personnel (7 jours) : ${link}` : `Compte créé : une invitation a été envoyée à ${email}.` };
}

export async function updateUserRoleAction(userId: string, fd: FormData) {
  const admin = await requireRole("ADMIN");
  const role = str(fd, "role") as Role;
  if (!ROLES.includes(role)) throw new Error("Rôle invalide");
  if (userId === admin.id && role !== "ADMIN") throw new Error("Vous ne pouvez pas retirer votre propre rôle administrateur");
  const organizationId = str(fd, "organizationId") || null;
  if ((role === "OF_ADMIN" || role === "TRAINER") && !organizationId) throw new Error("Un membre d'OF doit être rattaché à un organisme");
  if (organizationId && !(await db.organization.findUnique({ where: { id: organizationId }, select: { id: true } }))) throw new Error("Organisme introuvable");
  // Changement de rôle : les sessions ouvertes sont fermées (les droits sont recalculés à la reconnexion)
  await db.user.update({ where: { id: userId }, data: { role, organizationId: role === "ADMIN" ? null : organizationId, sessionVersion: { increment: 1 } } });
  await audit("user.role", { actorId: admin.id, organizationId, entityType: "User", entityId: userId, details: { role, organizationId } });
  revalidatePath("/admin/users");
}

export async function toggleUserActiveAction(userId: string) {
  const admin = await requireRole("ADMIN");
  if (userId === admin.id) throw new Error("Vous ne pouvez pas désactiver votre propre compte");
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.user.update({ where: { id: userId }, data: { active: !u.active, sessionVersion: { increment: 1 } } });
  await audit("user.active", { actorId: admin.id, organizationId: u.organizationId, entityType: "User", entityId: userId, details: { active: !u.active } });
  revalidatePath("/admin/users");
}

export async function resetPasswordAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireRole("ADMIN");
  const userId = str(fd, "userId");
  // Le mot de passe n'est jamais affiché : la personne reçoit un lien personnel pour en choisir un nouveau
  const u = await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(randomCode(24), 10), failedLogins: 0, lockedUntil: null, sessionVersion: { increment: 1 } },
  });
  await audit("user.password_reset", { actorId: admin.id, organizationId: u.organizationId, entityType: "User", entityId: userId });
  const link = await inviteStaffMember(u.id, admin.name);
  return { ok: link ? `Lien de réinitialisation à transmettre à ${u.email} : ${link}` : `Lien de réinitialisation envoyé à ${u.email}.` };
}

export async function deleteUserAction(userId: string) {
  const admin = await requireRole("ADMIN");
  if (userId === admin.id) throw new Error("Vous ne pouvez pas supprimer votre propre compte");
  const authored = await db.course.count({ where: { authorId: userId } });
  if (authored > 0) {
    // Les formations sont transférées à l'administrateur pour ne pas les perdre
    await db.course.updateMany({ where: { authorId: userId }, data: { authorId: admin.id } });
  }
  await db.rubric.updateMany({ where: { authorId: userId }, data: { authorId: admin.id } });
  await db.user.delete({ where: { id: userId } });
  await audit("user.delete", { actorId: admin.id, entityType: "User", entityId: userId });
  revalidatePath("/admin/users");
}

export async function saveSettingsAction(_: AdminState, fd: FormData): Promise<AdminState> {
  await requireRole("ADMIN");
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (!fd.has(key)) continue; // Champs absents du formulaire (ex. CGU versionnées dans le code) : inchangés
    const value = str(fd, key);
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  await audit("settings.update", { actorId: (await requireRole("ADMIN")).id });
  revalidatePath("/", "layout");
  return { ok: "Paramètres enregistrés." };
}

// ─────────────── Profil (tout utilisateur) ───────────────

export async function updateProfileAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireUser();
  const bio = str(fd, "bio").slice(0, 1000) || null;
  // Le nom d'un apprenant provient de son état civil vérifié par l'OF : il n'est pas modifiable ici
  if (user.role === "LEARNER") {
    await db.user.update({ where: { id: user.id }, data: { bio } });
    revalidatePath("/profile");
    return { ok: "Profil mis à jour." };
  }
  const name = str(fd, "name").slice(0, 120);
  if (name.length < 2) return { error: "Nom trop court." };
  await db.user.update({ where: { id: user.id }, data: { name, bio } });
  revalidatePath("/", "layout");
  return { ok: "Profil mis à jour." };
}

export async function changePasswordAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next.length < 8 || !/[0-9]/.test(next) || !/[A-Za-z]/.test(next)) {
    return { error: "Le nouveau mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre." };
  }
  if (next.length > 200) return { error: "Mot de passe trop long." };
  if (next === current) return { error: "Le nouveau mot de passe doit être différent de l'actuel." };
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(current, u.passwordHash))) return { error: "Mot de passe actuel incorrect." };
  // Les autres sessions ouvertes sont fermées ; la session courante est ré-émise
  const updated = await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10), sessionVersion: { increment: 1 } } });
  const token = await signSession({ uid: updated.id, role: updated.role, name: updated.name, sv: updated.sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  await audit("user.password_change", { actorId: user.id, organizationId: user.organizationId, entityType: "User", entityId: user.id });
  return { ok: "Mot de passe modifié. Vos autres sessions ont été déconnectées." };
}

// ─────────────── Organismes de formation ───────────────

export async function createOrganizationAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireRole("ADMIN");
  const name = str(fd, "name");
  if (name.length < 2) return { error: "Nom de l'organisme requis." };
  let slug = slugify(str(fd, "slug") || name) || "organisme";
  for (let i = 2; await db.organization.findUnique({ where: { slug } }); i++) slug = `${slugify(name)}-${i}`;
  const org = await db.organization.create({ data: { name, slug, email: str(fd, "email") || null } });
  let msg = `Organisme « ${name} » créé.`;
  const managerEmail = str(fd, "managerEmail").toLowerCase();
  if (managerEmail) {
    const existing = await db.user.findUnique({ where: { email: managerEmail } });
    if (existing) {
      await db.user.update({ where: { id: existing.id }, data: { role: "OF_ADMIN", organizationId: org.id } });
      msg += ` ${managerEmail} est désormais responsable de l'OF.`;
    } else {
      const manager = await db.user.create({
        data: { email: managerEmail, name: str(fd, "managerName") || managerEmail.split("@")[0], role: "OF_ADMIN", organizationId: org.id, passwordHash: await bcrypt.hash(randomCode(24), 10), createdVia: "ADMIN" },
      });
      await db.organization.update({ where: { id: org.id }, data: { supportReferentId: manager.id } });
      const link = await inviteStaffMember(manager.id, admin.name);
      msg += link ? ` Compte responsable créé : transmettez ce lien d'activation (7 jours) : ${link}` : ` Invitation envoyée à ${managerEmail}.`;
    }
  }
  await audit("organization.create", { actorId: admin.id, organizationId: org.id, entityType: "Organization", entityId: org.id });
  revalidatePath("/admin");
  return { ok: msg };
}

export async function toggleOrganizationAction(orgId: string) {
  const admin = await requireRole("ADMIN");
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  await db.organization.update({ where: { id: orgId }, data: { active: !org.active } });
  await audit("organization.update", { actorId: admin.id, organizationId: orgId, entityType: "Organization", entityId: orgId, details: { active: !org.active } });
  revalidatePath("/admin");
}
