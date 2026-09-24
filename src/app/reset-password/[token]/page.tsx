import Link from "next/link";
import { resetPasswordWithTokenAction } from "@/app/actions/password";
import { StateForm } from "@/components/StateForm";

export const metadata = { title: "Nouveau mot de passe" };

export default async function ResetPassword({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="card p-8">
        <h1 className="mb-6">Choisir un nouveau mot de passe</h1>
        <StateForm action={resetPasswordWithTokenAction.bind(null, token)} submitLabel="Enregistrer" submitClassName="btn-primary w-full">
          <input name="password" type="password" required minLength={8} className="input" placeholder="Nouveau mot de passe" autoComplete="new-password" />
          <input name="confirm" type="password" required minLength={8} className="input" placeholder="Confirmation" autoComplete="new-password" />
          <p className="text-xs text-slate-500">8 caractères minimum, dont une lettre et un chiffre.</p>
        </StateForm>
        <p className="mt-6 text-center text-sm"><Link href="/login" className="text-brand-600 hover:underline">Se connecter</Link></p>
      </div>
    </main>
  );
}
