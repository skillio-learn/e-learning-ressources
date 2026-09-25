"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Check, ChevronDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { LessonTypeIcon } from "@/components/LessonTypeIcon";
import type { OutlineModule } from "@/lib/progress";

export function OutlineNav({ slug, modules }: { slug: string; modules: OutlineModule[] }) {
  const path = usePathname();
  const activeId = path.split("/")[3];
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(modules.map((m, i) => [m.id, i === 0 || m.lessons.some((l) => l.id === activeId)])),
  );
  return (
    <nav className="p-2">
      {modules.map((m, i) => (
        <div key={m.id} className="mb-1">
          <button
            type="button"
            onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-100/60"
          >
            <span>
              <span className="eyebrow block text-[10px]">Module {i + 1}</span>
              <span className="mt-0.5 block text-[13px] font-semibold text-slate-900">{m.title}</span>
            </span>
            <span className="ml-2 shrink-0 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 tabular-nums">{m.completedCount}/{m.lessons.length} <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", !open[m.id] && "-rotate-90")} /></span>
            </span>
          </button>
          {open[m.id] && (
            <ol className="mb-2 ml-5 animate-fade-in border-l border-slate-200">
              {m.lessons.map((l, j) => {
                const active = l.id === activeId;
                const content = (
                  <>
                    <span
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold tabular-nums transition",
                        l.completed ? "bg-emerald-600 text-white" : active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
                      )}
                    >
                      {l.completed ? <Check className="h-3 w-3" strokeWidth={3} /> : l.locked ? <Lock className="h-2.5 w-2.5" strokeWidth={2.5} /> : j + 1}
                    </span>
                    <span className="flex-1 leading-snug">{l.title}</span>
                    <LessonTypeIcon type={l.type} className="opacity-70" />
                  </>
                );
                const cls = cn(
                  "-ml-px flex items-center gap-2.5 rounded-r-xl border-l-2 py-2 pl-3 pr-2 text-[13px] transition-colors",
                  active ? "border-brand-500 bg-slate-100 font-medium text-slate-900" : "border-transparent",
                  l.locked ? "cursor-not-allowed text-slate-500" : !active && "text-slate-600 hover:bg-slate-100/60 hover:text-slate-900",
                );
                return (
                  <li key={l.id}>
                    {l.locked ? (
                      <span className={cls} title="Terminez les étapes précédentes pour débloquer">{content}</span>
                    ) : (
                      <Link href={`/learn/${slug}/${l.id}`} className={cls}>{content}</Link>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ))}
    </nav>
  );
}
