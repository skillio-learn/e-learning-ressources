import { redirect } from "next/navigation";

/** L'inscription libre est fermée : les comptes apprenants sont créés par les organismes de formation. */
export default function RegisterPage() {
  redirect("/login");
}
