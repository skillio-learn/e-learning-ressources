import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { registerAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Créer un compte" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { next } = await searchParams;
  const settings = await getSettings();
  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="card p-8">
        <h1 className="mb-1">Créer un compte apprenant</h1>
        {settings.allowRegistration === "true" ? (
          <>
            <p className="mb-6 text-sm text-slate-500">Rejoignez {settings.platformName} et commencez à apprendre.</p>
            <AuthForm action={registerAction} mode="register" next={next} />
          </>
        ) : (
          <p className="text-sm text-slate-500">Les inscriptions sont fermées. Contactez votre formateur pour obtenir un accès.</p>
        )}
        <p className="mt-6 text-center text-sm text-slate-500">
          Déjà inscrit ?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
