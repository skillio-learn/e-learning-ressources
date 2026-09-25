import Link from "next/link";
import { ClipboardCheck, FileSignature, ShieldCheck, Layers } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { getCurrentUser, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

const HIGHLIGHTS = [
  { icon: Layers, label: "Parcours étape par étape" },
  { icon: ClipboardCheck, label: "Quiz et devoirs évalués" },
  { icon: FileSignature, label: "Conventions signées en ligne" },
  { icon: ShieldCheck, label: "Preuves pour les financeurs" },
];

const LEGAL = [
  ["/legal/mentions-legales", "Mentions légales"],
  ["/legal/cgu", "CGU"],
  ["/legal/confidentialite", "Confidentialité"],
  ["/legal/accessibilite", "Accessibilité"],
];

/** Page de présentation : un seul écran, sans catalogue ni inscription (les comptes sont créés par les OF). */
export default async function Home() {
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const cta = !user
    ? { href: "/login", label: "Se connecter" }
    : isStaff(user)
      ? { href: user.role === "ADMIN" ? "/admin" : "/of", label: user.role === "ADMIN" ? "Ouvrir l'administration" : "Ouvrir l'espace OF" }
      : { href: "/dashboard", label: "Reprendre ma formation" };

  return (
    <main className="flex h-[calc(100dvh-4rem-1px)] min-h-[560px] flex-col">
      {/* Accueil centré, une seule colonne (lisible de la même façon sur mobile, tablette et ordinateur) */}
      <section className="mx-auto flex w-full max-w-5xl flex-1 animate-fade-in flex-col items-center justify-center px-4 text-center">
        <p className="eyebrow">La plateforme des organismes de formation</p>
        <h1 className="mt-4 text-[40px] leading-[48px] md:text-[56px] md:leading-[64px]">L&apos;expertise qui accompagne.</h1>
        <p className="mt-5 max-w-[56ch] text-slate-500 md:text-lg md:leading-8">
          {settings.platformName} réunit parcours de formation, évaluations et preuves de réalisation dans une seule plateforme.
        </p>
        <Link href={cta.href} className="btn-primary btn-lg mt-8">{cta.label}</Link>
        {!user && <p className="mt-3 text-sm text-slate-500">Votre accès est créé par votre organisme de formation.</p>}
        <ul className="mt-12 hidden gap-x-10 gap-y-3 sm:grid sm:grid-cols-2 lg:flex lg:justify-center">
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 text-sm text-slate-700">
              <Icon className="h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.75} aria-hidden="true" /> {label}
            </li>
          ))}
        </ul>
      </section>

      <footer className="no-print border-t border-slate-200 bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-1 px-4 py-4 text-sm text-slate-500">
          {LEGAL.map(([href, label]) => (
            <Link key={href} href={href} className="transition-colors hover:text-brand-600">{label}</Link>
          ))}
          <span>© {new Date().getFullYear()} {settings.platformName}</span>
        </div>
      </footer>
    </main>
  );
}
