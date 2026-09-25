import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role, User } from "@prisma/client";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = Pick<User, "id" | "email" | "name" | "role" | "active" | "organizationId" | "accountStatus">;

/** Utilisateur connecté (relu en base à chaque requête pour refléter désactivation / changement de rôle). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.uid },
    select: { id: true, email: true, name: true, role: true, active: true, organizationId: true, accountStatus: true },
  });
  if (!user || !user.active) return null;
  return user;
});

/**
 * Utilisateur connecté obligatoire.
 * Un apprenant dont le compte n'est pas validé par l'OF est cantonné à son onboarding
 * (profil, pièces, assistance) : toute autre page le redirige vers /onboarding.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "LEARNER" && user.accountStatus !== "ACTIVE") {
    const pathname = (await headers()).get("x-pathname");
    const { isAllowedWhilePending } = await import("./onboarding");
    if (!isAllowedWhilePending(pathname)) redirect("/onboarding");
  }
  return user;
}

/** Apprenant au compte validé (pour les actions sensibles : candidature, inscription, suivi). */
export async function requireActiveLearnerAccount(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role === "LEARNER" && user.accountStatus !== "ACTIVE") redirect("/onboarding");
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
