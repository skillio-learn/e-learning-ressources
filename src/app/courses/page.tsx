import { redirect } from "next/navigation";
import { isStaff, requireUser } from "@/lib/auth";

/** Pas de catalogue public : l'équipe gère ses formations dans l'espace OF, l'apprenant retrouve les siennes. */
export default async function Catalog() {
  const user = await requireUser();
  redirect(isStaff(user) ? "/of/courses" : "/learn");
}
