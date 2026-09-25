"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { completeLessonAction } from "@/app/actions/learner";
import { activityStore } from "@/components/tracking/activity-store";
import { useLessonSeconds } from "@/components/tracking/LessonClock";
import { formatDuration } from "@/lib/labels";

export function CompleteButton({
  lessonId,
  completed,
  nextHref,
  minTimeSec,
  initialSeconds,
}: {
  lessonId: string;
  completed: boolean;
  nextHref: string;
  minTimeSec: number | null;
  initialSeconds: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { seconds } = useLessonSeconds(initialSeconds);
  const remaining = minTimeSec ? Math.max(0, minTimeSec - seconds) : 0;

  if (completed) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <span className="font-medium text-emerald-800">✓ Étape terminée</span>
        <Link href={nextHref} className="btn-primary ml-auto">Étape suivante</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-surface p-4">
      <span className="text-sm text-slate-600">
        {remaining > 0
          ? `Temps minimum de consultation : encore ${formatDuration(remaining)} avant de pouvoir valider cette étape.`
          : "Vous avez terminé cette étape ?"}
      </span>
      <button
        className="btn-primary ml-auto"
        disabled={pending || remaining > 0}
        onClick={() =>
          start(async () => {
            try {
              setError(null);
              await activityStore.flush();
              await completeLessonAction(lessonId);
              router.push(nextHref);
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          })
        }
      >
        {pending ? "Enregistrement…" : "Terminer l'étape"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function AutoComplete({ lessonId, minTimeSec, initialSeconds }: { lessonId: string; minTimeSec: number | null; initialSeconds: number }) {
  const router = useRouter();
  const done = useRef(false);
  const { seconds } = useLessonSeconds(initialSeconds);
  const ready = !minTimeSec || seconds >= minTimeSec;
  useEffect(() => {
    if (done.current || !ready) return;
    done.current = true;
    activityStore
      .flush()
      .then(() => completeLessonAction(lessonId))
      .then(() => router.refresh())
      .catch(() => (done.current = false));
  }, [lessonId, router, ready]);
  return null;
}
