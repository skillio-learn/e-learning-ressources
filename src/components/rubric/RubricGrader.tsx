"use client";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { RubricView } from "./RubricTable";

/** Grille d'évaluation interactive : le formateur clique sur un niveau par critère. Total calculé en direct. */
export function RubricGrader({
  rubric,
  initial,
}: {
  rubric: RubricView;
  initial: Record<string, { levelId: string | null; points: number; comment: string | null }>;
}) {
  const [sel, setSel] = useState<Record<string, { levelId: string | null; points: number; comment: string }>>(() =>
    Object.fromEntries(
      rubric.criteria.map((c) => [c.id, { levelId: initial[c.id]?.levelId ?? null, points: initial[c.id]?.points ?? 0, comment: initial[c.id]?.comment ?? "" }]),
    ),
  );
  const { total, max } = useMemo(() => {
    let total = 0;
    let max = 0;
    for (const c of rubric.criteria) {
      total += (sel[c.id]?.points ?? 0) * c.weight;
      max += Math.max(0, ...c.levels.map((l) => l.points)) * c.weight;
    }
    return { total, max };
  }, [sel, rubric.criteria]);
  const percent = max ? Math.round((total / max) * 1000) / 10 : 0;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rubric.criteria.map((c) => {
              const cmax = Math.max(0, ...c.levels.map((l) => l.points));
              const s = sel[c.id];
              return (
                <tr key={c.id}>
                  <td className="w-60 border border-slate-200 px-3 py-2 align-top">
                    <div className="font-semibold">{c.title}</div>
                    {c.description && <div className="mt-1 text-xs text-slate-500">{c.description}</div>}
                    {c.weight !== 1 && <div className="text-xs text-slate-400">×{c.weight}</div>}
                    <input type="hidden" name={`level_${c.id}`} value={s.levelId ?? ""} />
                    <div className="mt-2 flex items-center gap-1 text-xs">
                      <input
                        name={`points_${c.id}`}
                        type="number"
                        step="0.25"
                        min={0}
                        max={cmax}
                        value={s.points}
                        onChange={(e) => setSel((p) => ({ ...p, [c.id]: { ...p[c.id], points: Number(e.target.value) } }))}
                        className="input w-20 px-2 py-1"
                      />
                      <span className="text-slate-500">/ {cmax}</span>
                    </div>
                    <textarea
                      name={`comment_${c.id}`}
                      rows={2}
                      value={s.comment}
                      onChange={(e) => setSel((p) => ({ ...p, [c.id]: { ...p[c.id], comment: e.target.value } }))}
                      placeholder="Commentaire"
                      className="input mt-2 px-2 py-1 text-xs"
                    />
                  </td>
                  {c.levels.map((l) => (
                    <td key={l.id} className="border border-slate-200 p-0 align-top">
                      <button
                        type="button"
                        onClick={() => setSel((p) => ({ ...p, [c.id]: { ...p[c.id], levelId: l.id, points: l.points } }))}
                        className={cn(
                          "block h-full min-h-[90px] w-full min-w-[140px] px-3 py-2 text-left transition",
                          s.levelId === l.id ? "bg-brand-100 ring-2 ring-inset ring-brand-500" : "hover:bg-slate-50",
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium">{l.label}</span>
                          <span className="text-xs text-slate-500">{l.points} pt</span>
                        </div>
                        {l.description && <div className="mt-1 text-xs text-slate-600">{l.description}</div>}
                      </button>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={cn("flex items-center justify-between rounded-lg p-4", percent >= rubric.passingScore ? "bg-emerald-50" : "bg-amber-50")}>
        <div>
          <div className="text-sm text-slate-600">Total</div>
          <div className="text-2xl font-extrabold">
            {Math.round(total * 100) / 100} / {max} pt · {percent} %
          </div>
        </div>
        <div className="text-sm font-medium">{percent >= rubric.passingScore ? "✅ Validé" : `Seuil de validation : ${rubric.passingScore} %`}</div>
      </div>
    </div>
  );
}
