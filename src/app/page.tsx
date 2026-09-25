import Link from "next/link";
import { Award, BookOpen, ClipboardCheck, FileSignature, ShieldCheck, Layers } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { getCurrentUser, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

const HIGHLIGHTS = [
  { icon: Layers, label: "Parcours interactifs, étape par étape" },
  { icon: ClipboardCheck, label: "Quiz, devoirs et grilles d'évaluation" },
  { icon: FileSignature, label: "Conventions signées en ligne" },
  { icon: ShieldCheck, label: "Preuves de réalisation pour les financeurs" },
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
      <section className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-4 md:grid-cols-[1.1fr_1fr] md:gap-16">
        <div className="animate-fade-in">
          <p className="eyebrow">La plateforme des organismes de formation</p>
          <h1 className="mt-4 text-[40px] leading-[48px] md:text-[56px] md:leading-[64px]">L&apos;expertise qui accompagne.</h1>
          <p className="mt-5 max-w-[60ch] text-slate-500 md:text-lg md:leading-8">
            {settings.platformName} réunit parcours de formation, évaluations et preuves de réalisation dans une seule
            plateforme. Vos apprenants avancent à leur rythme, vous gardez la maîtrise de chaque étape.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href={cta.href} className="btn-primary btn-lg">{cta.label}</Link>
            {!user && <p className="text-sm text-slate-500">Votre accès est créé par votre organisme de formation.</p>}
          </div>
          <ul className="mt-10 hidden gap-x-8 gap-y-3 sm:grid sm:grid-cols-2">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-slate-700">
                <Icon className="h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.75} aria-hidden="true" /> {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Aperçu : deux cartes de formation telles qu'un apprenant les voit */}
        <div className="hidden animate-fade-in gap-4 md:grid" aria-hidden="true">
          <div className="card overflow-hidden">
            <div className="bg-brand-50 px-6 py-5 text-brand-600"><BookOpen className="h-6 w-6" strokeWidth={1.75} /></div>
            <div className="p-6">
              <div className="text-sm text-slate-500">6 modules, 4 h 30</div>
              <div className="mt-1 font-title text-xl text-slate-900">Gestion de projet agile</div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-brand-50"><div className="h-full w-[65%] rounded-full bg-brand-600" /></div>
              <div className="mt-2 text-sm text-slate-500">65 % terminé</div>
              <span className="btn-primary mt-5 pointer-events-none">Reprendre le module</span>
            </div>
          </div>
          <div className="card overflow-hidden md:ml-12">
            <div className="bg-ambre-100 px-6 py-5 text-brand-600"><Award className="h-6 w-6" strokeWidth={1.75} /></div>
            <div className="p-6">
              <div className="text-sm text-slate-500">5 modules, 3 h</div>
              <div className="mt-1 font-title text-xl text-slate-900">Management bienveillant</div>
              <span className="badge mt-4 bg-ambre-100 text-slate-900"><span className="h-1.5 w-1.5 rounded-full bg-ambre-400" />Parcours terminé</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="no-print border-t border-slate-200 bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-4 text-sm text-slate-500">
          {LEGAL.map(([href, label]) => (
            <Link key={href} href={href} className="transition-colors hover:text-brand-600">{label}</Link>
          ))}
          <span className="sm:ml-auto">© {new Date().getFullYear()} {settings.platformName}</span>
        </div>
      </footer>
    </main>
  );
}
