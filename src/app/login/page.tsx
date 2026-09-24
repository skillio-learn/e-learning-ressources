import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { loginAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { next } = await searchParams;
  const settings = await getSettings();
  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="card p-8">
        <h1 className="mb-1">Connexion</h1>
        <p className="mb-6 text-sm text-slate-500">Accédez à vos formations sur {settings.platformName}.</p>
        <AuthForm action={loginAction} mode="login" next={next} />
        <p className="mt-3 text-right text-sm">
          <Link href="/forgot-password" className="text-brand-600 hover:underline">Mot de passe oublié ?</Link>
        </p>
        {settings.allowRegistration === "true" && (
          <p className="mt-6 text-center text-sm text-slate-500">
            Pas encore de compte ?{" "}
            <Link href="/register" className="font-medium text-brand-600 hover:underline">
              Créer un compte
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
