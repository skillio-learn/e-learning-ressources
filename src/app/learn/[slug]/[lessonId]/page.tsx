import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getLearnContext } from "@/lib/learn";
import { markLessonStarted } from "@/lib/progress";
import { renderMarkdown } from "@/lib/markdown";
import { LessonTypeIcon } from "@/components/LessonTypeIcon";
import { LESSON_TYPE_LABELS, safeUrl, videoEmbed } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { InteractivePlayer } from "@/components/learn/InteractivePlayer";
import { AutoComplete, CompleteButton } from "@/components/learn/CompleteButton";
import { LessonClock } from "@/components/tracking/LessonClock";
import { QuizPanel } from "@/components/learn/QuizPanel";
import { AssignmentPanel } from "@/components/learn/AssignmentPanel";
import { ModuleResources } from "@/components/learn/ModuleResources";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { slug, lessonId } = await params;
  const { attempt } = await searchParams;
  const { user, course, outline, preview } = await getLearnContext(slug);

  const idx = outline.flat.findIndex((l) => l.id === lessonId);
  if (idx === -1) notFound();
  const entry = outline.flat[idx];
  if (entry.locked) redirect(`/learn/${slug}${outline.next ? `/${outline.next.id}` : ""}`);

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        select: { title: true, position: true, resources: { orderBy: { position: "asc" }, select: { id: true, title: true, description: true, url: true, fileName: true, size: true } } },
      },
    },
  });
  if (!lesson) notFound();
  if (!preview) await markLessonStarted(user.id, lesson.id);
  const progress = preview
    ? null
    : await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } }, select: { timeSpentSec: true } });
  const spent = progress?.timeSpentSec ?? 0;

  const moduleIndex = outline.modules.findIndex((m) => m.lessons.some((l) => l.id === lessonId));
  const prev = outline.flat[idx - 1];
  const next = outline.flat[idx + 1];
  const canComplete = !preview && !["QUIZ", "ASSIGNMENT"].includes(lesson.type);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-10">
      <div className="mb-4">
        <div className="text-xs font-semibold text-slate-500">
          Module {moduleIndex + 1} · {lesson.module.title} — Étape {entry.index}/{outline.total}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1>{lesson.title}</h1>
          <Badge tone="blue">
            <LessonTypeIcon type={lesson.type} className="text-brand-600" /> {LESSON_TYPE_LABELS[lesson.type]}
          </Badge>
          {lesson.durationMin ? <Badge>{lesson.durationMin} min</Badge> : null}
          {entry.completed && <Badge tone="green">✓ Terminée</Badge>}
          {!lesson.required && <Badge>Facultative</Badge>}
        </div>
        {lesson.summary && <p className="mt-2 text-slate-600">{lesson.summary}</p>}
        {!preview && (
          <div className="mt-3">
            <LessonClock initialSeconds={spent} minTimeSec={lesson.minTimeSec} />
          </div>
        )}
      </div>

      <div className="space-y-6">
        {lesson.type === "INTERACTIVE" && (
          <>
            <InteractivePlayer
              lessonId={lesson.id}
              title={lesson.title}
              src={lesson.htmlContent ? `/api/lessons/${lesson.id}/html` : safeUrl(lesson.embedUrl)}
              completionMode={lesson.completionMode}
              completed={entry.completed}
              preview={preview}
            />
            {lesson.content && (
              <div className="card prose-lms p-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.content) }} />
            )}
          </>
        )}

        {lesson.type === "VIDEO" && <VideoBlock url={lesson.videoUrl} />}

        {(lesson.type === "CONTENT" || lesson.type === "VIDEO" || lesson.type === "RESOURCE") && lesson.content && (
          <article className="card prose-lms p-6 md:p-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.content) }} />
        )}

        {lesson.type === "RESOURCE" && safeUrl(lesson.resourceUrl) && (
          <a href={safeUrl(lesson.resourceUrl)!} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Ouvrir / télécharger la ressource
          </a>
        )}

        {lesson.type === "QUIZ" && (
          <QuizPanel lessonId={lesson.id} userId={user.id} preview={preview} attemptId={attempt} slug={slug} />
        )}

        {lesson.type === "ASSIGNMENT" && (
          <AssignmentPanel lessonId={lesson.id} userId={user.id} preview={preview} content={lesson.content} />
        )}

        <ModuleResources moduleTitle={lesson.module.title} resources={lesson.module.resources} allHref={`/learn/${slug}/ressources`} />

        {canComplete && lesson.completionMode === "ON_VIEW" && !entry.completed && <AutoComplete lessonId={lesson.id} minTimeSec={lesson.minTimeSec} initialSeconds={spent} />}
        {canComplete && lesson.completionMode !== "ON_VIEW" && (
          <CompleteButton
            lessonId={lesson.id}
            completed={entry.completed}
            nextHref={next ? `/learn/${slug}/${next.id}` : `/learn/${slug}`}
            minTimeSec={lesson.minTimeSec}
            initialSeconds={spent}
          />
        )}
      </div>

      <div className="no-print mt-10 flex items-center justify-between gap-4 border-t border-slate-200 pt-6">
        {prev ? (
          <Link href={`/learn/${slug}/${prev.id}`} className="btn-secondary">← {prev.title}</Link>
        ) : (
          <span />
        )}
        {next ? (
          next.locked && !entry.completed ? (
            <span className="btn-secondary cursor-not-allowed opacity-60" title="Terminez cette étape pour continuer">
              {next.title}
            </span>
          ) : (
            <Link href={`/learn/${slug}/${next.id}`} className="btn-primary" title={next.title}>Étape suivante</Link>
          )
        ) : (
          <Link href={`/learn/${slug}`} className="btn-primary">Voir le récapitulatif</Link>
        )}
      </div>
      {course.sequential && !entry.completed && next && (
        <p className="mt-2 text-right text-xs text-slate-500">Parcours séquentiel : terminez cette étape pour débloquer la suivante.</p>
      )}
    </div>
  );
}

function VideoBlock({ url }: { url: string | null }) {
  const v = videoEmbed(url);
  if (!v) return <p className="text-slate-500">Aucune vidéo configurée.</p>;
  return (
    <div className="overflow-hidden rounded-xl bg-black shadow">
      {v.kind === "video" ? (
        <video src={v.src} controls className="aspect-video w-full" />
      ) : (
        <iframe
          src={v.src}
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          title="Vidéo"
        />
      )}
    </div>
  );
}
