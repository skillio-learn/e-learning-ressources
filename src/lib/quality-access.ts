import "server-only";
import { db } from "./db";
import { getCurrentUser } from "./auth";
import { canManageQuality } from "./qualiopi-evidence";
import { hashToken } from "./tokens";

/** Accès aux pièces du dossier qualité : responsable ou référent qualité de l'OF, ou auditeur muni d'un lien valide. */
export async function canReadQualityFile(orgId: string, token: string | null) {
  const user = await getCurrentUser();
  if (user && user.organizationId === orgId && (await canManageQuality(user))) return true;
  if (!token) return false;
  const access = await db.auditorAccess.findUnique({ where: { tokenHash: hashToken(token) } });
  return !!access && access.organizationId === orgId && !access.revokedAt && access.expiresAt > new Date();
}
