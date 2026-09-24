import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/password";
import { StateForm } from "@/components/StateForm";

export const metadata = { title: "Mot de passe oublié" };

export default function ForgotPassword() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="card p-8">
        <h1 className="mb-1">Mot de passe oublié</h1>
        <p className="mb-6 text-sm text-slate-500">Indiquez l&apos;email de votre compte.</p>
        <StateForm action={requestPasswordResetAction} submitLabel="Réinitialiser mon mot de passe" submitClassName="btn-primary w-full">
          <input name="email" type="email" required className="input" placeholder="vous@exemple.fr" autoComplete="email" />
        </StateForm>
        <p className="mt-6 text-center text-sm"><Link href="/login" className="text-brand-600 hover:underline">← Retour à la connexion</Link></p>
      </div>
    </main>
  );
}
