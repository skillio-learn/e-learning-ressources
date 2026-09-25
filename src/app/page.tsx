import Link from "next/link";
import { ArrowRight, ClipboardCheck, FileSignature, Fingerprint, Layers } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { getCurrentUser, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

const HIGHLIGHTS = [
  { icon: Layers, label: "Parcours interactifs" },
  { icon: ClipboardCheck, label: "Quiz & grilles d'évaluation" },
  { icon: FileSignature, label: "Signature électronique" },
  { icon: Fingerprint, label: "Preuves OPCO & France Travail" },
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
      ? { href: "/of", label: "Ouvrir l'espace OF" }
      : { href: "/dashboard", label: "Mon tableau de bord" };

  return (
    <main className="relative isolate flex h-[calc(100dvh-3.5rem-1px)] min-h-[520px] flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-14rem] h-[40rem] w-[40rem] -translate-x-[75%] animate-aurora rounded-full bg-[#0071e3]/[0.12] blur-[120px]" />
        <div className="absolute left-1/2 top-[-6rem] h-[34rem] w-[34rem] -translate-x-[10%] animate-aurora rounded-full bg-[#bf5af2]/[0.10] blur-[120px] [animation-delay:-9s]" />
        <div className="absolute bottom-[-18rem] left-1/2 h-[30rem] w-[50rem] -translate-x-1/2 rounded-full bg-[#5e5ce6]/[0.06] blur-[120px]" />
        <div className="bg-grid mask-fade-b absolute inset-0" />
      </div>

      <section className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="eyebrow animate-fade-up text-brand-500 [text-wrap:balance]">La plateforme des organismes de formation</div>
        <h1 className="mt-5 animate-fade-up font-display text-[2.05rem] font-semibold leading-[1.05] [text-wrap:balance] tracking-tightest text-slate-900 delay-100 sm:text-6xl md:text-7xl">
          Apprendre, pas à pas.
          <br />
          <span className="text-gradient animate-shimmer bg-[length:200%_auto]">Prouver chaque minute.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl animate-fade-up text-base leading-relaxed text-slate-600 delay-200 md:text-lg">
          {settings.platformName} réunit parcours interactifs, évaluations et toute la preuve de réalisation exigée par les
          financeurs, dans une seule plateforme.
        </p>
        <div className="mt-8 flex animate-fade-up flex-col items-center gap-3 delay-300">
          <Link href={cta.href} className="btn-primary btn-lg">
            {cta.label} <ArrowRight className="h-4 w-4" />
          </Link>
          {!user && <p className="text-xs text-slate-500">Votre accès est créé par votre organisme de formation.</p>}
        </div>
        <ul className="mt-10 hidden animate-fade-up flex-wrap justify-center gap-2 delay-500 sm:flex">
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-black/[0.07] bg-surface/70 px-3.5 py-1.5 text-[13px] text-slate-600 shadow-[0_1px_2px_rgb(0_0_0/0.04)] backdrop-blur"
            >
              <Icon className="h-3.5 w-3.5 text-brand-500" strokeWidth={2} /> {label}
            </li>
          ))}
        </ul>
      </section>

      <footer className="no-print flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-4 pb-5 text-[11px] text-slate-400">
        {LEGAL.map(([href, label]) => (
          <Link key={href} href={href} className="transition hover:text-slate-700">{label}</Link>
        ))}
        <span>© {new Date().getFullYear()} {settings.platformName}</span>
      </footer>
    </main>
  );
}
