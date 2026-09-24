"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { completeLessonAction } from "@/app/actions/learner";

export function CompleteButton({ lessonId, completed, nextHref }: { lessonId: string; completed: boolean; nextHref: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  if (completed) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <span className="font-medium text-emerald-800">✓ Étape terminée</span>
        <Link href={nextHref} className="btn-primary ml-auto">Étape suivante →</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <span className="text-sm text-slate-600">Vous avez terminé cette étape ?</span>
      <button
        className="btn-primary ml-auto"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              setError(null);
              await completeLessonAction(lessonId);
              router.push(nextHref);
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          })
        }
      >
        {pending ? "Enregistrement…" : "✓ Marquer comme terminé et continuer"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function AutoComplete({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    completeLessonAction(lessonId).then(() => router.refresh()).catch(() => {});
  }, [lessonId, router]);
  return null;
}
