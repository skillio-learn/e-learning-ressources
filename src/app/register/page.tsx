import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { registerAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { AuthShell } from "@/components/AuthShell";

export const metadata = { title: "Créer un compte" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; of?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { next, of } = await searchParams;
  const org = of ? await db.organization.findFirst({ where: { slug: of, active: true }, select: { name: true, slug: true } }) : null;
  const organizations = org
    ? []
    : await db.organization.findMany({ where: { active: true, allowSelfRegistration: true }, select: { slug: true, name: true, city: true }, orderBy: { name: "asc" } });
  const settings = await getSettings();
  return (
    <AuthShell title="Créer un compte" subtitle={<>Rejoignez {settings.platformName} et commencez à apprendre.</>}>
        {settings.allowRegistration === "true" ? (
          <>
            {org && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">Inscription auprès de l&apos;organisme <b>{org.name}</b></p>}
            <AuthForm action={registerAction} mode="register" next={next} of={org?.slug} organizations={organizations} />
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Après la création de votre compte, vous compléterez vos informations administratives. L&apos;organisme vérifie votre dossier puis valide votre accès à la plateforme.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Les inscriptions sont fermées. Contactez votre formateur pour obtenir un accès.</p>
        )}
        <p className="mt-6 text-center text-sm text-slate-500">
          Déjà inscrit ?{" "}
          <Link href="/login" className="link font-medium">
            Se connecter
          </Link>
        </p>
    </AuthShell>
  );
}
