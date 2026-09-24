import "server-only";
import { db } from "./db";

export async function notify(userId: string, title: string, body?: string | null, link?: string | null) {
  try {
    await db.notification.create({ data: { userId, title, body: body ?? null, link: link ?? null } });
  } catch (e) {
    console.error("notify failed", e);
  }
}

/** Notifie les responsables d'un OF (et à défaut les super admins). */
export async function notifyOrgManagers(organizationId: string, title: string, body?: string | null, link?: string | null) {
  const managers = await db.user.findMany({
    where: { active: true, OR: [{ role: "OF_ADMIN", organizationId }, { role: "ADMIN" }] },
    select: { id: true, role: true },
  });
  const ofAdmins = managers.filter((m) => m.role === "OF_ADMIN");
  const targets = ofAdmins.length ? ofAdmins : managers;
  await Promise.all(targets.map((m) => notify(m.id, title, body, link)));
}
