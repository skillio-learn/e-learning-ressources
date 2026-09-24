import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role, User } from "@prisma/client";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = Pick<User, "id" | "email" | "name" | "role" | "active" | "organizationId">;

/** Utilisateur connecté (relu en base à chaque requête pour refléter désactivation / changement de rôle). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.uid },
    select: { id: true, email: true, name: true, role: true, active: true, organizationId: true },
  });
  if (!user || !user.active) return null;
  return user;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard?denied=1");
  return user;
}

/** Équipe OF (super admin, responsable OF, formateur). */
export const STAFF_ROLES: Role[] = ["ADMIN", "OF_ADMIN", "TRAINER"];
/** Gestion administrative d'un OF (dossiers, inscriptions, rapports, paramètres). */
export const OF_MANAGER_ROLES: Role[] = ["ADMIN", "OF_ADMIN"];

export const isStaff = (u: Pick<CurrentUser, "role"> | null) => !!u && STAFF_ROLES.includes(u.role);
export const isOfManager = (u: Pick<CurrentUser, "role"> | null) => !!u && OF_MANAGER_ROLES.includes(u.role);

export const requireStaff = () => requireRole(...STAFF_ROLES);
export const requireOfManager = () => requireRole(...OF_MANAGER_ROLES);
