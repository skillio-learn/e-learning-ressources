"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { randomCode, slugify, str } from "@/lib/utils";
import { audit } from "@/lib/audit";

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
  const password = str(fd, "password") || randomCode(10) + "7";
  if (password.length < 8) return { error: "Mot de passe : 8 caractères minimum." };
  const organizationId = str(fd, "organizationId") || null;
  if ((role === "OF_ADMIN" || role === "TRAINER") && !organizationId) return { error: "Choisissez l'organisme de rattachement." };
  const created = await db.user.create({
    data: {
      email, name, role, organizationId, passwordHash: await bcrypt.hash(password, 10), createdVia: "ADMIN",
      // Un apprenant complète son dossier administratif, validé ensuite par son OF
      ...(role === "LEARNER" ? { accountStatus: "PENDING_PROFILE" as const } : {}),
    },
  });
  await audit("user.create", { actorId: admin.id, organizationId, entityType: "User", entityId: created.id, details: { role } });
  revalidatePath("/admin/users");
  return { ok: `Compte créé pour ${email} — mot de passe : ${password}` };
}

export async function updateUserRoleAction(userId: string, fd: FormData) {
  const admin = await requireRole("ADMIN");
  const role = str(fd, "role") as Role;
  if (!ROLES.includes(role)) throw new Error("Rôle invalide");
  if (userId === admin.id && role !== "ADMIN") throw new Error("Vous ne pouvez pas retirer votre propre rôle administrateur");
  const organizationId = str(fd, "organizationId") || null;
  if ((role === "OF_ADMIN" || role === "TRAINER") && !organizationId) throw new Error("Un membre d'OF doit être rattaché à un organisme");
  await db.user.update({ where: { id: userId }, data: { role, organizationId } });
  await audit("user.role", { actorId: admin.id, organizationId, entityType: "User", entityId: userId, details: { role, organizationId } });
  revalidatePath("/admin/users");
}

export async function toggleUserActiveAction(userId: string) {
  const admin = await requireRole("ADMIN");
  if (userId === admin.id) throw new Error("Vous ne pouvez pas désactiver votre propre compte");
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.user.update({ where: { id: userId }, data: { active: !u.active } });
  await audit("user.active", { actorId: admin.id, organizationId: u.organizationId, entityType: "User", entityId: userId, details: { active: !u.active } });
  revalidatePath("/admin/users");
}

export async function resetPasswordAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireRole("ADMIN");
  const userId = str(fd, "userId");
  const password = randomCode(10) + "7";
  const u = await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 10), failedLogins: 0, lockedUntil: null },
  });
  await audit("user.password_reset", { actorId: admin.id, organizationId: u.organizationId, entityType: "User", entityId: userId });
  return { ok: `Nouveau mot de passe pour ${u.email} : ${password}` };
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
    const value = key === "allowRegistration" ? (fd.get(key) === "on" ? "true" : "false") : str(fd, key);
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  await audit("settings.update", { actorId: (await requireRole("ADMIN")).id });
  revalidatePath("/", "layout");
  return { ok: "Paramètres enregistrés." };
}

// ─────────────── Profil (tout utilisateur) ───────────────

export async function updateProfileAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireUser();
  const name = str(fd, "name");
  if (name.length < 2) return { error: "Nom trop court." };
  await db.user.update({ where: { id: user.id }, data: { name, bio: str(fd, "bio") || null } });
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
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(current, u.passwordHash))) return { error: "Mot de passe actuel incorrect." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: "Mot de passe modifié." };
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
      const password = randomCode(10) + "7";
      await db.user.create({
        data: { email: managerEmail, name: str(fd, "managerName") || managerEmail.split("@")[0], role: "OF_ADMIN", organizationId: org.id, passwordHash: await bcrypt.hash(password, 10) },
      });
      msg += ` Compte responsable créé : ${managerEmail} / ${password}`;
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
