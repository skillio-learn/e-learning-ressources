"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { TERMS_VERSION } from "@/lib/terms";

/** Enregistre l'acceptation horodatée de la version en vigueur des CGU. */
export async function acceptTermsAction(fd: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (fd.get("accept") !== "on") redirect("/terms");
  await db.user.update({ where: { id: user.id }, data: { termsAcceptedVersion: TERMS_VERSION, consentAt: new Date() } });
  await audit("terms.accept", { actorId: user.id, organizationId: user.organizationId, entityType: "User", entityId: user.id, details: `CGU ${TERMS_VERSION}` });
  const next = String(fd.get("next") ?? "");
  // Chemin interne uniquement (pas de redirection ouverte)
  const safe = /^\/(?![/\\])[^\\\u0000-\u001f]*$/.test(next) && !next.startsWith("/terms");
  redirect(safe ? next : user.role === "COMPANY" ? "/entreprise" : "/dashboard");
}
