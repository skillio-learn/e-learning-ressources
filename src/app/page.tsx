import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import { CourseCard } from "@/components/CourseCard";

export const dynamic = "force-dynamic";

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
    <main>
      <section className="bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-white md:text-5xl">{settings.platformName}</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">{settings.tagline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/courses" className="btn bg-white text-brand-700 hover:bg-brand-50">Voir le catalogue</Link>
            {user ? (
              <Link href="/dashboard" className="btn border border-white/40 text-white hover:bg-white/10">Mon tableau de bord</Link>
            ) : (
              <Link href="/login" className="btn border border-white/40 text-white hover:bg-white/10">Se connecter</Link>
            )}
          </div>
          <div className="mt-12 grid gap-4 text-sm sm:grid-cols-3">
            {[
              ["✨ Modules interactifs", "Des leçons immersives, étape par étape, avec suivi automatique."],
              ["❓ Quiz & évaluations", "QCM, vrai/faux, questions ouvertes corrigées par votre formateur."],
              ["🏅 Certificats", "Validez la formation et téléchargez votre attestation de réussite."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl bg-white/10 p-4">
                <div className="font-semibold">{t}</div>
                <div className="mt-1 text-white/80">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {courses.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-xl">Formations à la une</h2>
            <Link href="/courses" className="text-sm font-medium text-brand-600 hover:underline">Tout voir →</Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <CourseCard key={c.id} href={`/courses/${c.slug}`} course={c} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
