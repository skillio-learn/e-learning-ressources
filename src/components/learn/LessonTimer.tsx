"use client";
import { useEffect } from "react";
import { trackTimeAction } from "@/app/actions/learner";

/** Mesure le temps passé (onglet visible uniquement) et l'envoie périodiquement. */
export function LessonTimer({ lessonId }: { lessonId: string }) {
  useEffect(() => {
    let acc = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") acc += (now - last) / 1000;
      last = now;
    };
    const flush = () => {
      tick();
      if (acc >= 5) {
        const s = acc;
        acc = 0;
        trackTimeAction(lessonId, s).catch(() => {});
      }
    };
    const id = setInterval(flush, 60_000);
    const onVis = () => (document.visibilityState === "hidden" ? flush() : (last = Date.now()));
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      flush();
    };
  }, [lessonId]);
  return null;
}
