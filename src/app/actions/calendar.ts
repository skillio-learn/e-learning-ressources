"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** Crée (ou renouvelle, ce qui invalide l'ancien lien) le flux d'agenda personnel. */
export async function renewCalendarTokenAction() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { calendarToken: randomBytes(24).toString("base64url") } });
  revalidatePath("/profile");
}

export async function disableCalendarAction() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { calendarToken: null } });
  revalidatePath("/profile");
}
