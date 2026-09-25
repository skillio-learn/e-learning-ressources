import "server-only";
import { db } from "./db";
import { sendTemplatedEmail } from "./email";

/**
 * Notification dans l'application + email aux couleurs de Vylia (si l'envoi est configuré).
 * L'email porte le nom de l'organisme du destinataire et renvoie les réponses vers son adresse de contact.
 */
export async function notify(userId: string, title: string, body?: string | null, link?: string | null, opts: { email?: boolean } = {}) {
  try {
    await db.notification.create({ data: { userId, title, body: body ?? null, link: link ?? null } });
    if (opts.email !== false) {
      const u = await db.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, active: true, role: true, profile: { select: { firstName: true } }, organization: { select: { name: true, email: true } } },
      });
      if (u?.active) {
        const first = u.profile?.firstName ?? u.name.split(" ")[0];
        const org = u.role === "ADMIN" ? null : u.organization;
        await sendTemplatedEmail(
          u.email,
          title,
          { title, paragraphs: [`Bonjour ${first},`, ...(body ? body.split(/\n{2,}/) : [])], cta: link ? { url: link } : undefined },
          { orgName: org?.name, replyTo: org?.email, tag: "notification" },
        );
      }
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

/** Équipe pédagogique d'une formation : auteur, formateurs associés et responsables de l'OF (corrections à faire). */
export async function notifyCourseGraders(courseId: string, title: string, body: string, link: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { authorId: true, organizationId: true, trainers: { select: { userId: true } } },
  });
  if (!course) return;
  const managers = await db.user.findMany({ where: { active: true, role: "OF_ADMIN", organizationId: course.organizationId }, select: { id: true } });
  const ids = new Set([course.authorId, ...course.trainers.map((t) => t.userId), ...managers.map((m) => m.id)]);
  const staff = await db.user.findMany({ where: { id: { in: [...ids] }, active: true, role: { in: ["OF_ADMIN", "TRAINER"] } }, select: { id: true } });
  await Promise.all(staff.map((u) => notify(u.id, title, body, link)));
}
