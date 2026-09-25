import "server-only";
import { db } from "./db";
import { sendEmail } from "./email";

/** Notification dans l'application + email (si l'envoi d'emails est configuré). */
export async function notify(userId: string, title: string, body?: string | null, link?: string | null, opts: { email?: boolean } = {}) {
  try {
    await db.notification.create({ data: { userId, title, body: body ?? null, link: link ?? null } });
    if (opts.email !== false) {
      const u = await db.user.findUnique({ where: { id: userId }, select: { email: true, active: true } });
      if (u?.active) await sendEmail(u.email, title, body ?? "", link);
    }
  } catch (e) {
    console.error("notify failed", e);
  }
}

/** Notifie les responsables d'un OF. L'administrateur Vylia n'intervient pas dans l'espace OF. */
export async function notifyOrgManagers(organizationId: string, title: string, body?: string | null, link?: string | null) {
  const managers = await db.user.findMany({ where: { active: true, role: "OF_ADMIN", organizationId }, select: { id: true } });
  await Promise.all(managers.map((m) => notify(m.id, title, body, link)));
}
