import "server-only";
import { db } from "./db";
import { getClientInfo } from "./request";

/** Journal d'audit : toute action sensible est tracée (qui, quoi, quand, depuis où). */
export async function audit(
  action: string,
  opts: { actorId?: string | null; organizationId?: string | null; entityType?: string; entityId?: string; details?: unknown } = {},
) {
  try {
    const { ip } = await getClientInfo().catch(() => ({ ip: null }));
    await db.auditLog.create({
      data: {
        action,
        actorId: opts.actorId ?? null,
        organizationId: opts.organizationId ?? null,
        entityType: opts.entityType,
        entityId: opts.entityId,
        details: opts.details === undefined ? null : typeof opts.details === "string" ? opts.details : JSON.stringify(opts.details),
        ip,
      },
    });
  } catch (e) {
    console.error("audit failed", action, e);
  }
}

export const AUDIT_LABELS: Record<string, string> = {
  "auth.login": "Connexion",
  "auth.logout": "Déconnexion",
  "auth.register": "Création de compte",
  "application.submit": "Dépôt de dossier",
  "application.status": "Changement de statut du dossier",
  "application.message": "Message sur un dossier",
  "application.document.review": "Vérification d'un justificatif",
  "enrollment.create": "Inscription définitive",
  "enrollment.update": "Modification d'inscription",
  "enrollment.status": "Changement de statut d'inscription",
  "export.connections": "Export des connexions",
  "export.gradebook": "Export du carnet de notes",
  "export.report": "Export de rapport",
  "document.download": "Téléchargement d'un justificatif",
  "organization.update": "Modification des paramètres OF",
  "organization.create": "Création d'un organisme",
  "user.create": "Création d'utilisateur",
  "user.role": "Changement de rôle",
  "user.active": "Activation / désactivation",
  "user.password_reset": "Réinitialisation de mot de passe",
  "user.delete": "Suppression d'utilisateur",
  "grade.quiz": "Correction de quiz",
  "grade.submission": "Évaluation de devoir",
  "lesson.force_complete": "Validation manuelle d'étape",
  "quiz.reset_attempts": "Réinitialisation des tentatives",
  "attendance.sign": "Émargement",
  "complaint.update": "Traitement de réclamation",
  "rgpd.export": "Export RGPD des données personnelles",
  "rgpd.deletion_request": "Demande de suppression de compte",
  "settings.update": "Paramètres plateforme",
};
