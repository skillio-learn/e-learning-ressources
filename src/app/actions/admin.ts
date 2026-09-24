"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { randomCode, str } from "@/lib/utils";

const ROLES: Role[] = ["ADMIN", "TRAINER", "LEARNER"];

export type AdminState = { error?: string; ok?: string } | undefined;

export async function createUserAction(_: AdminState, fd: FormData): Promise<AdminState> {
  await requireRole("ADMIN");
  const email = str(fd, "email").toLowerCase();
  const name = str(fd, "name");
  const role = str(fd, "role") as Role;
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Nom et email valides requis." };
  if (!ROLES.includes(role)) return { error: "Rôle invalide." };
  if (await db.user.findUnique({ where: { email } })) return { error: "Un compte existe déjà avec cet email." };
  const password = str(fd, "password") || randomCode(10);
  if (password.length < 8) return { error: "Mot de passe : 8 caractères minimum." };
  await db.user.create({ data: { email, name, role, passwordHash: await bcrypt.hash(password, 10) } });
  revalidatePath("/admin/users");
  return { ok: `Compte créé pour ${email} — mot de passe : ${password}` };
}

export async function updateUserRoleAction(userId: string, fd: FormData) {
  const admin = await requireRole("ADMIN");
  const role = str(fd, "role") as Role;
  if (!ROLES.includes(role)) throw new Error("Rôle invalide");
  if (userId === admin.id && role !== "ADMIN") throw new Error("Vous ne pouvez pas retirer votre propre rôle administrateur");
  await db.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
}

export async function toggleUserActiveAction(userId: string) {
  const admin = await requireRole("ADMIN");
  if (userId === admin.id) throw new Error("Vous ne pouvez pas désactiver votre propre compte");
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.user.update({ where: { id: userId }, data: { active: !u.active } });
  revalidatePath("/admin/users");
}

export async function resetPasswordAction(_: AdminState, fd: FormData): Promise<AdminState> {
  await requireRole("ADMIN");
  const userId = str(fd, "userId");
  const password = randomCode(10);
  const u = await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
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
  revalidatePath("/admin/users");
}

export async function saveSettingsAction(_: AdminState, fd: FormData): Promise<AdminState> {
  await requireRole("ADMIN");
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const value = key === "allowRegistration" ? (fd.get(key) === "on" ? "true" : "false") : str(fd, key);
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
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
  if (next.length < 8) return { error: "Le nouveau mot de passe doit contenir au moins 8 caractères." };
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(current, u.passwordHash))) return { error: "Mot de passe actuel incorrect." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: "Mot de passe modifié." };
}
