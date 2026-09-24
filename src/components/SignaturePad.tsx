"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Pavé de signature manuscrite (souris, doigt, stylet) → image PNG. */
export function SignaturePad({ onSign, label = "Signer" }: { onSign: (dataUrl: string) => Promise<void>; label?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [strokes, setStrokes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvas}
        className="h-36 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-[#fff]"
        onPointerDown={(e) => {
          drawing.current = true;
          const ctx = canvas.current!.getContext("2d")!;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          canvas.current!.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvas.current!.getContext("2d")!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          setStrokes((s) => s + 1);
        }}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => {
            const c = canvas.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            setStrokes(0);
          }}
        >
          Effacer
        </button>
        <button
          type="button"
          className="btn-primary btn-sm ml-auto"
          disabled={strokes === 0 || pending}
          onClick={() =>
            start(async () => {
              try {
                setError(null);
                await onSign(canvas.current!.toDataURL("image/png"));
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            })
          }
        >
          {pending ? "Enregistrement…" : label}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
