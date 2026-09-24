import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/password";
import { StateForm } from "@/components/StateForm";
import { AuthShell } from "@/components/AuthShell";

export const metadata = { title: "Mot de passe oublié" };

export default function ForgotPassword() {
  return (
    <AuthShell title="Mot de passe oublié" subtitle="Indiquez l'email de votre compte.">
        <StateForm action={requestPasswordResetAction} submitLabel="Réinitialiser mon mot de passe" submitClassName="btn-primary w-full">
          <input name="email" type="email" required className="input" placeholder="vous@exemple.fr" autoComplete="email" />
        </StateForm>
        <p className="mt-6 text-center text-sm"><Link href="/login" className="link">Retour à la connexion</Link></p>
    </AuthShell>
  );
}
