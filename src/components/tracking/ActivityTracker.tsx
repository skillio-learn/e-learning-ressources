"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { activityStore } from "./activity-store";

const BEAT_MS = 30_000;

/**
 * Mesure le temps de connexion ACTIF (onglet visible + interaction récente) et l'envoie au serveur
 * toutes les 30 s. Au-delà du délai d'inactivité de l'OF, le chronomètre est suspendu et une
 * confirmation de présence est demandée.
 */
export function ActivityTracker({ timeoutMin, interactiveTimeoutMin }: { timeoutMin: number; interactiveTimeoutMin: number }) {
  const path = usePathname();
  const seg = path.split("/");
  const lessonId = seg[1] === "learn" && seg.length >= 4 ? seg[3] : null;
  const lessonRef = useRef<string | null>(lessonId);
  const pending = useRef(0);
  const lastInteraction = useRef(Date.now());
  const [idle, setIdle] = useState(false);
    const timeoutMs = Math.max(1, timeoutMin) * 60_000;
  const interactiveMs = Math.max(timeoutMs, Math.max(1, interactiveTimeoutMin) * 60_000);

  // Changement de page : on envoie le temps accumulé sur la page précédente
  useEffect(() => {
    if (lessonRef.current !== lessonId) {
      flush(lessonRef.current);
      lessonRef.current = lessonId;
      activityStore.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  function flush(forLesson: string | null, beacon = false): Promise<void> {
    const seconds = Math.round(pending.current);
    pending.current -= seconds;
    const payload = JSON.stringify({ lessonId: forLesson, seconds });
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/activity", new Blob([payload], { type: "text/plain" }));
      return Promise.resolve();
    }
    return fetch("/api/activity", { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "text/plain" } })
      .then(() => undefined)
      .catch(() => undefined);
  }

  useEffect(() => {
    activityStore.registerFlush(() => flush(lessonRef.current));
    return () => activityStore.registerFlush(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mark = () => {
      lastInteraction.current = Date.now();
      if (activityStore.get().idle) return; // la reprise se fait via le bouton
    };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    // Interaction dans un module interactif (iframe) : focus ou message du pont lms-bridge.js
    const onBlur = () => setTimeout(() => {
      if (document.activeElement?.tagName === "IFRAME") mark();
    }, 0);
    window.addEventListener("blur", onBlur);
    const onMsg = (e: MessageEvent) => {
      const d = typeof e.data === "string" ? safeParse(e.data) : e.data;
      if (d && typeof d === "object" && typeof d.type === "string" && d.type.startsWith("lms:")) mark();
    };
    window.addEventListener("message", onMsg);

    let last = Date.now();
    const tick = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      const visible = document.visibilityState === "visible";
            // Dans un module interactif (iframe), l'activité n'est pas visible par la page : délai plus long
      const inIframe = document.activeElement?.tagName === "IFRAME";
      const recent = now - lastInteraction.current < (inIframe ? interactiveMs : timeoutMs);
      if (!recent && !activityStore.get().idle) {
        activityStore.set({ idle: true });
        setIdle(true);
      }
      const active = (visible || inIframe) && recent && !activityStore.get().idle;
      if (active && dt < 5) {
        pending.current += dt;
        activityStore.set({ activeSinceLoad: activityStore.get().activeSinceLoad + dt });
      }
    }, 1000);
    const beat = setInterval(() => flush(lessonRef.current), BEAT_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(lessonRef.current, true);
    };
    document.addEventListener("visibilitychange", onHide);
    const onUnload = () => flush(lessonRef.current, true);
    window.addEventListener("pagehide", onUnload);
    // Premier battement : ouvre / prolonge la session de connexion
    flush(lessonRef.current);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("message", onMsg);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onUnload);
      clearInterval(tick);
      clearInterval(beat);
      flush(lessonRef.current, true);
    };
        // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs, interactiveMs]);

  if (!idle) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-900/60 p-4">
      <div className="card max-w-md p-6 text-center">
        <div className="text-4xl">⏸️</div>
        <h2 className="mt-2">Êtes-vous toujours là ?</h2>
        <p className="mt-2 text-sm text-slate-600">
          Aucune activité détectée depuis {timeoutMin} minutes. Le chronomètre de formation est en pause : seul le temps
          d&apos;activité réelle est comptabilisé.
        </p>
        <button
          className="btn-primary mt-4"
          onClick={() => {
            lastInteraction.current = Date.now();
            activityStore.set({ idle: false });
            setIdle(false);
          }}
        >
          Je suis là, reprendre
        </button>
      </div>
    </div>
  );
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
