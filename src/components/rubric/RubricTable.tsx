import { cn } from "@/lib/utils";

export type RubricView = {
  title: string;
  description?: string | null;
  passingScore: number;
  criteria: {
    id: string;
    title: string;
    description: string | null;
    weight: number;
    levels: { id: string; label: string; description: string | null; points: number }[];
  }[];
};

/** Grille d'évaluation critériée (lecture). Met en évidence les niveaux attribués si `scores` est fourni. */
export function RubricTable({
  rubric,
  scores,
}: {
  rubric: RubricView;
  scores?: Record<string, { levelId: string | null; points: number; comment: string | null }>;
}) {
  const max = rubric.criteria.reduce((s, c) => s + Math.max(0, ...c.levels.map((l) => l.points)) * c.weight, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left">Critère</th>
            <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left" colSpan={99}>Niveaux de maîtrise</th>
          </tr>
        </thead>
        <tbody>
          {rubric.criteria.map((c) => {
            const s = scores?.[c.id];
            return (
              <tr key={c.id}>
                <td className="w-56 border border-slate-200 px-3 py-2 align-top">
                  <div className="font-semibold">{c.title}</div>
                  {c.description && <div className="mt-1 text-xs text-slate-500">{c.description}</div>}
                  {c.weight !== 1 && <div className="mt-1 text-xs text-slate-400">Coefficient ×{c.weight}</div>}
                  {s && (
                    <div className="mt-2 text-xs font-semibold text-brand-700">
                      {s.points * c.weight} pt{s.comment && <div className="mt-1 font-normal italic text-slate-600">« {s.comment} »</div>}
                    </div>
                  )}
                </td>
                {c.levels.map((l) => (
                  <td
                    key={l.id}
                    className={cn(
                      "min-w-[140px] border border-slate-200 px-3 py-2 align-top",
                      s?.levelId === l.id && "bg-brand-100 ring-2 ring-inset ring-brand-500",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{l.label}</span>
                      <span className="text-xs text-slate-500">{l.points} pt</span>
                    </div>
                    {l.description && <div className="mt-1 text-xs text-slate-600">{l.description}</div>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        Total maximum : {max} pt · Seuil de validation : {rubric.passingScore} %
      </p>
    </div>
  );
}

export const rubricInclude = {
  criteria: { orderBy: { position: "asc" as const }, include: { levels: { orderBy: { position: "asc" as const } } } },
};
