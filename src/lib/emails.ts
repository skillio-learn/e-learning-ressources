import "server-only";
import { db } from "./db";
import { sendTemplatedEmail } from "./email";

/** Email d'activation : lien personnel + formations déjà prévues (un seul email pour tout démarrer). */
export async function sendActivationEmail(learnerId: string, link: string, courses: string[]) {
  const u = await db.user.findUniqueOrThrow({
    where: { id: learnerId },
    select: { email: true, name: true, profile: { select: { firstName: true } }, organization: { select: { name: true, email: true } } },
  });
  const orgName = u.organization?.name ?? "Votre organisme de formation";
  return sendTemplatedEmail(
    u.email,
    `${orgName} vous invite sur Vylia`,
    {
      title: "Bienvenue sur Vylia",
      preheader: `Activez votre compte pour démarrer${courses.length ? ` : ${courses[0]}` : ""}.`,
      paragraphs: [
        `Bonjour ${u.profile?.firstName ?? u.name.split(" ")[0]},`,
        `${orgName} vous a créé un compte sur Vylia, la plateforme où vous suivrez votre formation.`,
        "Pour commencer : choisissez votre mot de passe, complétez vos informations administratives et déposez vos pièces justificatives." +
          (courses.length ? " Vous pourrez aussi, dans la foulée, signer ou déposer vos documents d'inscription (convention, CGV, règlement intérieur)." : ""),
      ],
      itemsTitle: courses.length ? (courses.length > 1 ? "Vos formations" : "Votre formation") : undefined,
      items: courses,
      cta: { url: link, label: "Activer mon compte" },
      note: "Ce lien personnel est valable 7 jours. Passé ce délai, demandez un nouveau lien à votre organisme.",
    },
    { orgName: u.organization?.name, replyTo: u.organization?.email, tag: "activation" },
  );
}

