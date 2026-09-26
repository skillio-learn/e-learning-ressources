"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completeLessonAction } from "@/app/actions/learner";

type Mode = "MANUAL" | "AUTO" | "ON_VIEW";

/**
 * Lecteur des modules interactifs (iframe).
 * Le module peut signaler sa progression via postMessage (voir /lms-bridge.js) :
 *   { type: "lms:complete", score?: 0-100 }  → étape terminée
 *   { type: "lms:progress", value: 0-100 }  → progression affichée
 *   { type: "lms:resize", height: number }  → ajuste la hauteur
 */
export function InteractivePlayer({
  lessonId,
  title,
  src,
  completionMode,
  completed,
  preview,
}: {
  lessonId: string;
  title: string;
  src: string | null;
  completionMode: Mode;
  completed: boolean;
  preview: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [done, setDone] = useState(completed);
  // Grand format dans le même onglet (et non un nouvel onglet) : le temps de formation reste comptabilisé
  const [expanded, setExpanded] = useState(false);
  const sent = useRef(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [expanded]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const data = typeof e.data === "string" ? safeParse(e.data) : e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "lms:progress" && typeof data.value === "number") setProgress(Math.round(data.value));
      if (data.type === "lms:resize" && typeof data.height === "number") setHeight(Math.min(Math.max(data.height, 300), 5000));
      if (data.type === "lms:complete") {
        setProgress(100);
        if (preview || sent.current || completionMode === "MANUAL") {
          if (completionMode === "MANUAL") setDone(true);
          return;
        }
        sent.current = true;
        const score = typeof data.score === "number" ? data.score : null;
        completeLessonAction(lessonId, score)
          .then(() => {
            setDone(true);
            router.refresh();
          })
          .catch(() => (sent.current = false));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [lessonId, completionMode, preview, router]);

  if (!src) {
    return <div className="card p-6 text-slate-500">Aucun module interactif n&apos;est configuré pour cette leçon.</div>;
  }

  return (
    <div ref={wrapper} className={expanded ? "fixed inset-0 z-[90] flex flex-col bg-surface" : "overflow-hidden rounded-xl border border-slate-200 bg-surface"}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2 text-sm">
        <span className="font-medium text-slate-700">Module interactif</span>
        <div className="flex items-center gap-3">
          {progress !== null && <span className="text-xs text-slate-500">Progression : {progress} %</span>}
          {completionMode === "AUTO" && !done && (
            <span className="text-xs text-slate-500">Se valide automatiquement à la fin du module</span>
          )}
          {done && <span className="text-xs font-medium text-emerald-600">✓ Terminé</span>}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setExpanded((v) => !v)} title="Afficher le module sur toute la fenêtre, le temps reste comptabilisé">
            {expanded ? "Réduire" : "Agrandir"}
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => wrapper.current?.requestFullscreen?.()}
          >
            Plein écran
          </button>
        </div>
      </div>
      <iframe
        ref={frame}
        src={src}
        title={title}
        className={expanded ? "block w-full flex-1 bg-surface" : height ? "block w-full bg-surface" : "block h-[75vh] min-h-[520px] w-full bg-surface"}
        style={height && !expanded ? { height } : undefined}
        allow="autoplay; fullscreen; clipboard-write; encrypted-media"
        allowFullScreen
        sandbox={src.startsWith("/api/") ? "allow-scripts allow-forms allow-popups allow-modals allow-downloads" : undefined}
      />
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
