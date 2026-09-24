import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { renderMarkdown } from "@/lib/markdown";
import { enrollAction } from "@/app/actions/learner";
import { Badge, Container } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { LESSON_TYPE_ICONS, LESSON_TYPE_LABELS, LEVEL_LABELS } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const course = await db.course.findUnique({
    where: { slug },
    include: {
      author: { select: { name: true, bio: true } },
      trainers: { include: { user: { select: { name: true } } } },
      modules: {
        orderBy: { position: "asc" },
        include: { lessons: { where: { published: true }, orderBy: { position: "asc" }, select: { id: true, title: true, type: true, durationMin: true } } },
      },
    },
  });
  if (!course) notFound();
  const manager = user ? await canManageCourse(user, course.id) : false;
  if (course.status !== "PUBLISHED" && !manager) notFound();

  const enrollment = user
    ? await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } })
    : null;
  const lessonCount = course.modules.reduce((s, m) => s + m.lessons.length, 0);
  const minutes = course.modules.reduce((s, m) => s + m.lessons.reduce((t, l) => t + (l.durationMin ?? 0), 0), 0);

  return (
    <main>
      <section className="bg-slate-900 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-[1fr_340px]">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              {course.category && <Badge tone="blue">{course.category}</Badge>}
              <Badge>{LEVEL_LABELS[course.level]}</Badge>
              {course.status !== "PUBLISHED" && <Badge tone="amber">Aperçu formateur – non publiée</Badge>}
            </div>
            <h1 className="text-3xl font-extrabold text-white">{course.title}</h1>
            {course.subtitle && <p className="mt-3 text-lg text-white/80">{course.subtitle}</p>}
            <p className="mt-4 text-sm text-white/60">
              Formateur : {[course.author.name, ...course.trainers.map((t) => t.user.name)].join(", ")}
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/80">
              <span>📚 {course.modules.length} module(s)</span>
              <span>🧩 {lessonCount} leçon(s)</span>
              {(course.durationHours || minutes > 0) && <span>⏱️ {course.durationHours ? `${course.durationHours} h` : `${Math.round(minutes / 6) / 10} h`}</span>}
              {course.sequential && <span>🪜 Parcours étape par étape</span>}
              {course.certificateEnabled && <span>🏅 Certificat</span>}
            </div>
          </div>
          <div className="card self-start p-5 text-slate-800">
            {course.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.coverUrl} alt="" className="mb-4 aspect-video w-full rounded-lg object-cover" />
            )}
            {enrollment ? (
              <Link href={`/learn/${course.slug}`} className="btn-primary w-full">Continuer la formation</Link>
            ) : manager ? (
              <Link href={`/learn/${course.slug}`} className="btn-primary w-full">Prévisualiser comme apprenant</Link>
            ) : !user ? (
              <Link href={`/login?next=/courses/${course.slug}`} className="btn-primary w-full">Se connecter pour s&apos;inscrire</Link>
            ) : course.enrollmentPolicy === "OPEN" ? (
              <form action={enrollAction.bind(null, course.id)}>
                <SubmitButton className="btn-primary w-full" pendingLabel="Inscription…">S&apos;inscrire gratuitement</SubmitButton>
              </form>
            ) : (
              <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
                Inscription sur invitation : contactez votre formateur pour accéder à cette formation.
              </p>
            )}
            {manager && (
              <Link href={`/trainer/courses/${course.id}`} className="btn-secondary mt-2 w-full">Modifier la formation</Link>
            )}
          </div>
        </div>
      </section>

      <Container className="grid gap-8 md:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          {course.description && (
            <section>
              <h2 className="mb-2">Présentation</h2>
              <div className="prose-lms" dangerouslySetInnerHTML={{ __html: renderMarkdown(course.description) }} />
            </section>
          )}
          {course.objectives && (
            <section className="card p-5">
              <h2 className="mb-2">🎯 Objectifs pédagogiques</h2>
              <div className="prose-lms" dangerouslySetInnerHTML={{ __html: renderMarkdown(course.objectives) }} />
            </section>
          )}
          <section>
            <h2 className="mb-3">Programme</h2>
            <div className="space-y-3">
              {course.modules.map((m, i) => (
                <details key={m.id} className="card group" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between p-4">
                    <span className="font-semibold">
                      Module {i + 1} · {m.title}
                    </span>
                    <span className="text-xs text-slate-500">{m.lessons.length} leçon(s)</span>
                  </summary>
                  <ol className="border-t border-slate-100 px-4 py-2">
                    {m.lessons.map((l, j) => (
                      <li key={l.id} className="flex items-center gap-3 py-1.5 text-sm">
                        <span className="w-6 text-right text-slate-400">{j + 1}.</span>
                        <span title={LESSON_TYPE_LABELS[l.type]}>{LESSON_TYPE_ICONS[l.type]}</span>
                        <span className="flex-1">{l.title}</span>
                        {l.durationMin ? <span className="text-xs text-slate-400">{l.durationMin} min</span> : null}
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-4">
          {course.prerequisites && (
            <div className="card p-5">
              <h2 className="mb-2 text-base">Prérequis</h2>
              <div className="prose-lms text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(course.prerequisites) }} />
            </div>
          )}
          {course.audience && (
            <div className="card p-5">
              <h2 className="mb-2 text-base">Public visé</h2>
              <div className="prose-lms text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(course.audience) }} />
            </div>
          )}
        </aside>
      </Container>
    </main>
  );
}
