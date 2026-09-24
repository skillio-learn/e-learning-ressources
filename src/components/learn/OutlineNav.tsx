"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn, LESSON_TYPE_ICONS } from "@/lib/utils";
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
            className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-slate-50"
          >
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Module {i + 1}</span>
              <span className="text-sm font-semibold text-slate-800">{m.title}</span>
            </span>
            <span className="ml-2 shrink-0 text-xs text-slate-400">
              {m.completedCount}/{m.lessons.length} {open[m.id] ? "▾" : "▸"}
            </span>
          </button>
          {open[m.id] && (
            <ol className="mb-2 ml-2 border-l border-slate-200">
              {m.lessons.map((l, j) => {
                const active = l.id === activeId;
                const content = (
                  <>
                    <span
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                        l.completed ? "bg-emerald-500 text-white" : active ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-600",
                      )}
                    >
                      {l.completed ? "✓" : l.locked ? "🔒" : j + 1}
                    </span>
                    <span className="flex-1 leading-snug">{l.title}</span>
                    <span className="text-xs opacity-70">{LESSON_TYPE_ICONS[l.type]}</span>
                  </>
                );
                const cls = cn(
                  "-ml-px flex items-center gap-2 border-l-2 py-1.5 pl-3 pr-2 text-sm",
                  active ? "border-brand-600 bg-brand-50 font-medium text-brand-800" : "border-transparent",
                  l.locked ? "cursor-not-allowed text-slate-400" : "text-slate-700 hover:bg-slate-50",
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
