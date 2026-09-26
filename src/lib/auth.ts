import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role, User } from "@prisma/client";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = Pick<User, "id" | "email" | "name" | "role" | "active" | "organizationId" | "accountStatus" | "companyId"> & {
  termsAcceptedVersion: string | null;
  mfaEnabled: boolean;
  mfaRequired: boolean; // L'OF exige la double authentification pour son équipe
};

/** Utilisateur connecté (relu en base à chaque requête pour refléter désactivation / changement de rôle). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const u = await db.user.findUnique({
    where: { id: session.uid },
    select: {
      id: true, email: true, name: true, role: true, active: true, organizationId: true, accountStatus: true, sessionVersion: true,
      companyId: true, termsAcceptedVersion: true, totpEnabledAt: true,
      organization: { select: { active: true, mfaRequired: true } },
    },
  });
  if (!u || !u.active) return null;
  // Session émise avant le dernier changement de mot de passe / révocation : invalide
  if ((session.sv ?? 0) !== u.sessionVersion) return null;
  // Organisme désactivé par Vylia : ses membres et apprenants n'ont plus accès
  if (u.role !== "ADMIN" && u.organization && !u.organization.active) return null;
  const { sessionVersion: _sv, organization, totpEnabledAt, ...rest } = u;
  return {
    ...rest,
    mfaEnabled: !!totpEnabledAt,
    mfaRequired: (u.role === "OF_ADMIN" || u.role === "TRAINER") && !!organization?.mfaRequired,
  };
});

/**
 * Utilisateur connecté obligatoire.
 * Un apprenant dont le compte n'est pas validé par l'OF est cantonné à son onboarding
 * (profil, pièces, assistance) : toute autre page le redirige vers /onboarding.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const pathname = (await headers()).get("x-pathname");
  const under = (prefixes: string[]) => !!pathname && prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
  // CGU : acceptation de la version en vigueur avant tout usage
  const { TERMS_VERSION } = await import("./terms");
  if (user.termsAcceptedVersion !== TERMS_VERSION && !under(["/terms", "/legal", "/api"])) {
    redirect(`/terms?next=${encodeURIComponent(pathname ?? "/")}`);
  }
  // Double authentification exigée par l'OF : configuration obligatoire avant d'accéder à l'espace
  if (user.mfaRequired && !user.mfaEnabled && !under(["/profile/security", "/terms", "/legal", "/api"])) {
    redirect("/profile/security?required=1");
  }
  // Entreprise cliente : cantonnée à son espace
  if (user.role === "COMPANY" && !under(["/entreprise", "/profile", "/notifications", "/terms", "/legal", "/documents", "/api"])) {
    redirect("/entreprise");
  }
  if (user.role === "LEARNER" && user.accountStatus !== "ACTIVE") {
    const { isAllowedWhilePending } = await import("./onboarding");
    if (!isAllowedWhilePending(pathname)) redirect("/onboarding");
  }
  return user;
}

/** Apprenant au compte validé (pour les actions sensibles : candidature, inscription, suivi). */
export async function requireActiveLearnerAccount(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role === "COMPANY") redirect("/entreprise");
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
export const requireCompany = () => requireRole("COMPANY");

/** Assistance des apprenants : réservée aux responsables de l'organisme concerné (ni formateurs, ni admin plateforme). */
export const canHandleSupport = (u: Pick<CurrentUser, "role" | "organizationId"> | null, organizationId: string | null) =>
  !!u && u.role === "OF_ADMIN" && !!organizationId && organizationId === u.organizationId;
