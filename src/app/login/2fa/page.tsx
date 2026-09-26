import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { StateForm } from "@/components/StateForm";
import { verifyMfaLoginAction } from "@/app/actions/auth";
import { MFA_COOKIE, verifyMfaChallenge } from "@/lib/session";

export const metadata = { title: "Double authentification" };
export const dynamic = "force-dynamic";

export default async function MfaLogin() {
  const challenge = await verifyMfaChallenge((await cookies()).get(MFA_COOKIE)?.value);
  if (!challenge) redirect("/login");
  return (
    <AuthShell title="Vérification" subtitle="Saisissez le code à 6 chiffres affiché par votre application d'authentification.">
      <StateForm action={verifyMfaLoginAction} submitLabel="Valider le code" submitClassName="btn-primary w-full">
        <label className="block">
          <span className="label">Code de vérification</span>
          <input name="code" required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={11} className="input text-center text-lg tracking-[0.3em]" />
        </label>
        <p className="text-sm text-slate-500">Téléphone perdu ? Saisissez l&apos;un de vos codes de secours (format XXXXX-XXXXX).</p>
      </StateForm>
    </AuthShell>
  );
}
