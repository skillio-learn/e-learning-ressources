import "server-only";
import { createHash, randomBytes } from "crypto";
import { db } from "./db";
import { appUrl, emailEnabled, sendTemplatedEmail } from "./email";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Lien personnel pour définir son mot de passe. Les liens précédents non utilisés sont invalidés. */
export async function issuePasswordLink(userId: string, ttlMs: number) {
  await db.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  const token = randomBytes(32).toString("hex");
  await db.passwordResetToken.create({ data: { userId, tokenHash: hash(token), expiresAt: new Date(Date.now() + ttlMs) } });
  return `/reset-password/${token}`;
}

/**
 * Invitation d'un membre d'équipe (responsable, formateur, administrateur) : email avec lien pour choisir son mot de passe.
 * Retourne le lien à transmettre si l'envoi d'emails n'est pas configuré, sinon null.
 */
export async function inviteStaffMember(userId: string, invitedBy: string) {
  const link = await issuePasswordLink(userId, 7 * 24 * 3600_000);
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true, role: true, organization: { select: { name: true, email: true } } } });
  const roleLabel = u.role === "ADMIN" ? "administrateur de la plateforme" : u.role === "OF_ADMIN" ? "responsable de l'organisme" : "formateur";
  const sent = emailEnabled()
    ? await sendTemplatedEmail(
        u.email,
        u.organization ? `Rejoignez ${u.organization.name} sur Vylia` : "Votre accès à Vylia",
        {
          title: "Votre accès à Vylia",
          paragraphs: [
            `Bonjour ${u.name.split(" ")[0]},`,
            `${invitedBy} vous a ouvert un accès ${roleLabel}${u.organization ? ` pour ${u.organization.name}` : ""} sur Vylia.`,
            "Choisissez votre mot de passe pour activer votre compte.",
          ],
          cta: { url: link, label: "Activer mon accès" },
          note: "Lien personnel valable 7 jours, utilisable une seule fois.",
        },
        { orgName: u.role === "ADMIN" ? null : u.organization?.name, replyTo: u.organization?.email, tag: "invitation" },
      )
    : false;
  return sent ? null : appUrl(link);
}
