"use client";
import { useSyncExternalStore } from "react";
import { activityStore } from "./activity-store";
import { formatDuration } from "@/lib/labels";

export function useLessonSeconds(initialSeconds: number) {
  const s = useSyncExternalStore(activityStore.subscribe, activityStore.get, activityStore.get);
  return { seconds: initialSeconds + s.activeSinceLoad, idle: s.idle };
}

/** Chronomètre visible de la leçon (temps actif cumulé) + temps minimum requis. */
export function LessonClock({ initialSeconds, minTimeSec }: { initialSeconds: number; minTimeSec: number | null }) {
  const { seconds, idle } = useLessonSeconds(initialSeconds);
  const pct = minTimeSec ? Math.min(100, Math.round((seconds / minTimeSec) * 100)) : null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
      <span className={idle ? "text-amber-600" : "text-slate-700"}>
        ⏱ Temps sur cette étape : <b className="tabular-nums">{formatDuration(seconds)}</b>
        {idle && " (en pause)"}
      </span>
      {minTimeSec ? (
        <span className="flex items-center gap-2 text-xs text-slate-500">
          Minimum requis : {formatDuration(minTimeSec)}
          <span className="inline-block h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
            <span className={`block h-full ${pct === 100 ? "bg-emerald-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
          </span>
          {pct === 100 && <span className="text-emerald-600">✓</span>}
        </span>
      ) : null}
    </div>
  );
}
