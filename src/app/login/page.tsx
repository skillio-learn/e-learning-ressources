import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { loginAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AuthShell } from "@/components/AuthShell";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { next } = await searchParams;
  const settings = await getSettings();
  return (
    <AuthShell title="Connexion" subtitle={<>Accédez à vos formations sur {settings.platformName}.</>}>
        <AuthForm action={loginAction} next={next} />
        <p className="mt-3 text-right text-sm">
          <Link href="/forgot-password" className="link">Mot de passe oublié ?</Link>
        </p>
        <p className="mt-6 border-t border-black/[0.06] pt-5 text-center text-xs leading-relaxed text-slate-500">
          Votre compte est créé par votre organisme de formation. Utilisez le lien d&apos;activation reçu pour choisir votre mot de passe.
        </p>
    </AuthShell>
  );
}
