import Link from "next/link";
import { ArrowRight, BadgeCheck, ClipboardCheck, FileSignature, Fingerprint, FolderCheck, HeartHandshake, Layers, Sparkles, Timer } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import { CourseCard } from "@/components/CourseCard";
import { LogoMark } from "@/components/brand/Logo";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: Layers,
    title: "Parcours étape par étape",
    text: "Modules, leçons, modules interactifs HTML, vidéos et ressources, déverrouillés dans l'ordre avec un temps minimum par étape.",
    className: "md:col-span-2",
  },
  { icon: Timer, title: "Chaque minute tracée", text: "Heartbeat, détection d'inactivité, journal de connexion horodaté avec IP." },
  { icon: ClipboardCheck, title: "Quiz & grilles", text: "QCM notés automatiquement, mises en situation évaluées par grille critériée." },
  { icon: FileSignature, title: "Signé en ligne", text: "Convention, contrat, émargement apprenant et formateur signés électroniquement." },
  { icon: FolderCheck, title: "Dossiers d'inscription", text: "Profil, financement, positionnement et justificatifs, vérifiés puis validés par l'organisme." },
  { icon: HeartHandshake, title: "Qualité continue", text: "Satisfaction à chaud et à froid, avis des financeurs, messagerie pédagogique et réclamations." },
  {
    icon: Fingerprint,
    className: "md:col-span-2",
    title: "Prêt pour le contrôle",
    text: "Relevés de connexion, attestations d'assiduité, certificats de réalisation et exports CSV pour OPCO, France Travail et Caisse des dépôts.",
  },
];

export default async function Home() {
  const [settings, user, courses] = await Promise.all([
    getSettings(),
    getCurrentUser(),
    db.course.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { _count: { select: { modules: true } } },
    }),
  ]);
  return (
    <main className="overflow-hidden">
      {/* ── Hero ── */}
      <section className="relative isolate">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-18rem] h-[42rem] w-[42rem] -translate-x-[70%] animate-aurora rounded-full bg-[#2997ff]/25 blur-[120px]" />
          <div className="absolute left-1/2 top-[-10rem] h-[36rem] w-[36rem] -translate-x-[5%] animate-aurora rounded-full bg-[#bf5af2]/20 blur-[120px] [animation-delay:-9s]" />
          <div className="bg-grid mask-fade-b absolute inset-0" />
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-20 pt-24 text-center md:pt-32">
          <Link
            href="/courses"
            className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 text-xs text-slate-600 backdrop-blur transition hover:border-white/20 hover:text-slate-900"
          >
            <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">Nouveau</span>
            Traçabilité OPCO & France Travail intégrée
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <h1 className="mt-8 animate-fade-up font-display text-5xl font-semibold leading-[1.03] tracking-tightest text-slate-900 delay-100 sm:text-6xl md:text-7xl">
            Apprendre, pas à pas.
            <br />
            <span className="text-gradient animate-shimmer bg-[length:200%_auto]">Prouver chaque minute.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg leading-relaxed text-slate-600 delay-200 md:text-xl">
            {settings.platformName} réunit vos parcours interactifs, vos évaluations et toute la preuve de réalisation
            exigée par les financeurs. Dans une seule plateforme, élégante et sans friction.
          </p>
          <div className="mt-10 flex animate-fade-up flex-wrap items-center justify-center gap-3 delay-300">
            <Link href="/courses" className="btn-primary btn-lg">
              Découvrir les formations
            </Link>
            <Link href={user ? "/dashboard" : "/login"} className="btn btn-lg text-brand-500 hover:text-brand-400">
              {user ? "Mon tableau de bord" : "Se connecter"} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Aperçu produit */}
        <div className="relative mx-auto max-w-5xl animate-fade-up px-4 pb-24 delay-500">
          <div className="absolute inset-x-10 -top-6 bottom-20 -z-10 rounded-[2.5rem] bg-gradient-to-r from-[#2997ff]/30 via-[#7b61ff]/25 to-[#bf5af2]/30 blur-3xl" />
          <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0c0c0f]/90 shadow-2xl ring-1 ring-black backdrop-blur">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 truncate rounded-full bg-white/[0.05] px-3 py-1 text-[11px] text-slate-500">vylia.app/learn</span>
            </div>
            <div className="grid gap-0 md:grid-cols-[240px_1fr]">
              <aside className="hidden border-r border-white/[0.06] p-5 text-left md:block">
                <div className="eyebrow">Module 1</div>
                <ul className="mt-3 space-y-1 text-[13px]">
                  {["Bienvenue", "Les formats verticaux", "La ligne éditoriale", "Quiz – fondamentaux", "Mise en situation"].map((l, i) => (
                    <li
                      key={l}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${i === 2 ? "bg-white/[0.06] text-slate-900" : "text-slate-500"}`}
                    >
                      {i < 2 ? (
                        <BadgeCheck className="h-4 w-4 text-emerald-500" strokeWidth={2} />
                      ) : (
                        <span className={`h-4 w-4 rounded-full border ${i === 2 ? "border-brand-500" : "border-slate-300"}`} />
                      )}
                      {l}
                    </li>
                  ))}
                </ul>
              </aside>
              <div className="p-6 text-left md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="eyebrow">Leçon 3 sur 13</div>
                    <div className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900">La ligne éditoriale</div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs text-slate-600 ring-1 ring-white/10">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    Temps actif · 07:42
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Progression", "46 %"],
                    ["Quiz", "18 / 20"],
                    ["Assiduité", "100 %"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{k}</div>
                      <div className="mt-1 font-display text-2xl font-semibold text-slate-900">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full w-[46%] rounded-full bg-[linear-gradient(90deg,#2997ff,#7b61ff,#bf5af2)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Fonctionnalités ── */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="eyebrow text-brand-500">Tout-en-un</div>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tightest md:text-5xl">
            Pensé pour les apprenants.
            <br />
            <span className="text-slate-500">Taillé pour les contrôles.</span>
          </h2>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text, className }) => (
            <div
              key={title}
              className={`group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-7 transition duration-500 hover:border-white/15 ${className ?? ""}`}
            >
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#2997ff]/0 blur-3xl transition duration-700 group-hover:bg-[#2997ff]/20" />
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
                <Icon className="h-5 w-5 text-brand-500" strokeWidth={1.75} />
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Formations ── */}
      {courses.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Catalogue</div>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tightest">Formations à la une</h2>
            </div>
            <Link href="/courses" className="link inline-flex items-center gap-1 text-sm font-medium">
              Tout voir <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <CourseCard key={c.id} href={`/courses/${c.slug}`} course={c} />
            ))}
          </div>
        </section>
      )}

      {/* ── Appel à l'action ── */}
      <section className="px-4 py-24">
        <div className="relative isolate mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 px-6 py-16 text-center">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(41,151,255,0.28),transparent_70%)]" />
          <LogoMark className="mx-auto h-12 w-12 animate-float" />
          <h2 className="mt-6 font-display text-4xl font-semibold tracking-tightest md:text-5xl">Votre prochaine formation commence ici.</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500">Déposez votre dossier en quelques minutes, l&apos;organisme s&apos;occupe du reste.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/courses" className="btn-primary btn-lg">
              <Sparkles className="h-4 w-4" /> Parcourir le catalogue
            </Link>
            {!user && settings.allowRegistration === "true" && (
              <Link href="/register" className="btn-secondary btn-lg">
                Créer un compte
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
