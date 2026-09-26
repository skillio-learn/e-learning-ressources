"use server";

import { db } from "@/lib/db";
import { INSERTION_SITUATIONS } from "@/lib/labels";
import { optStr, str } from "@/lib/utils";

export type SState = { error?: string; ok?: string } | undefined;

/** Réponse à l'enquête d'insertion (lien personnel, sans connexion). */
export async function submitInsertionSurveyAction(token: string, _: SState, fd: FormData): Promise<SState> {
  const s = await db.insertionSurvey.findUnique({ where: { token } });
  if (!s) return { error: "Enquête introuvable." };
  if (s.answeredAt) return { ok: "Merci, votre réponse est déjà enregistrée." };
  const situation = str(fd, "situation");
  if (!INSERTION_SITUATIONS[situation]) return { error: "Indiquez votre situation actuelle." };
  const related = str(fd, "relatedToTraining");
  const skills = Number(str(fd, "skillsUsed"));
  await db.insertionSurvey.update({
    where: { id: s.id },
    data: {
      situation,
      relatedToTraining: related === "yes" ? true : related === "no" ? false : null,
      skillsUsed: skills >= 1 && skills <= 5 ? skills : null,
      comment: optStr(fd, "comment")?.slice(0, 2000) ?? null,
      answeredAt: new Date(),
    },
  });
  return { ok: "Merci ! Votre réponse aide l'organisme à améliorer ses formations et à publier des résultats fiables." };
}
