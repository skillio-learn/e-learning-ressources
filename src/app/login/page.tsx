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
        <AuthForm action={loginAction} mode="login" next={next} />
        <p className="mt-3 text-right text-sm">
          <Link href="/forgot-password" className="link">Mot de passe oublié ?</Link>
        </p>
        {settings.allowRegistration === "true" && (
          <p className="mt-6 text-center text-sm text-slate-500">
            Pas encore de compte ?{" "}
            <Link href="/register" className="link font-medium">
              Créer un compte
            </Link>
          </p>
        )}
    </AuthShell>
  );
}
