"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRubricAction, type RubricInput } from "@/app/actions/of";
import { Trash2 } from "lucide-react";

const DEFAULT_LEVELS = [
  { label: "Insuffisant", description: "", points: 0 },
  { label: "À améliorer", description: "", points: 1 },
  { label: "Satisfaisant", description: "", points: 2 },
  { label: "Excellent", description: "", points: 3 },
];

export function RubricEditor({
  rubricId,
  initial,
  courses,
  attachToLessonId,
  returnTo,
  locked,
}: {
  rubricId: string | null;
  initial: RubricInput;
  courses: { id: string; title: string }[];
  attachToLessonId?: string | null;
  returnTo?: string | null;
  locked?: boolean;
}) {
  const [r, setR] = useState<RubricInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const setCrit = (i: number, patch: Partial<RubricInput["criteria"][number]>) =>
    setR((p) => ({ ...p, criteria: p.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const setLevel = (i: number, k: number, patch: Partial<RubricInput["criteria"][number]["levels"][number]>) =>
    setCrit(i, { levels: r.criteria[i].levels.map((l, j) => (j === k ? { ...l, ...patch } : l)) });
  const moveCrit = (i: number, d: number) =>
    setR((p) => {
      const c = [...p.criteria];
      const j = i + d;
      if (j < 0 || j >= c.length) return p;
      [c[i], c[j]] = [c[j], c[i]];
      return { ...p, criteria: c };
    });

  const max = r.criteria.reduce((s, c) => s + Math.max(0, ...c.levels.map((l) => Number(l.points) || 0)) * (Number(c.weight) || 0), 0);

  const save = () =>
    start(async () => {
      try {
        setError(null);
        setOk(false);
        const res = await saveRubricAction(rubricId, r, attachToLessonId);
        if (returnTo) router.push(returnTo);
        else if (!rubricId) router.push(`/of/rubrics/${res.id}`);
        else {
          setOk(true);
          router.refresh();
        }
      } catch (e) {
        setError((e as Error).message);
      }
    });

  return (
    <div className="space-y-6">
      {locked && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Cette grille a déjà servi à évaluer des devoirs : ses critères ne peuvent plus être modifiés. Dupliquez-la pour créer une nouvelle version.
        </p>
      )}
      <section className="card grid gap-4 p-6 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="label">Titre de la grille *</span>
          <input className="input" value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} placeholder="Ex : Grille – Réalisation d'une vidéo courte" />
        </label>
        <label className="block md:col-span-2">
          <span className="label">Description / contexte d&apos;évaluation</span>
          <textarea className="input" rows={2} value={r.description ?? ""} onChange={(e) => setR({ ...r, description: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">Rattachement</span>
          <select className="input" value={r.courseId ?? ""} onChange={(e) => setR({ ...r, courseId: e.target.value || null })}>
            <option value="">Grille partagée (toutes formations)</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Seuil de validation (%)</span>
          <input type="number" min={0} max={100} className="input" value={r.passingScore} onChange={(e) => setR({ ...r, passingScore: Number(e.target.value) })} />
        </label>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2>Critères d&apos;évaluation ({r.criteria.length}) · total {max} pt</h2>
        </div>
        {r.criteria.map((c, i) => (
          <div key={i} className="card space-y-3 p-5">
            <div className="flex flex-wrap items-start gap-3">
              <span className="mt-2 grid h-7 w-7 place-items-center rounded-md bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
              <div className="grid flex-1 gap-3 md:grid-cols-[1fr_120px]">
                <input className="input font-medium" placeholder="Intitulé du critère" value={c.title} onChange={(e) => setCrit(i, { title: e.target.value })} />
                <label className="flex items-center gap-2 text-sm">
                  Coef.
                  <input type="number" min={0} step={0.5} className="input" value={c.weight} onChange={(e) => setCrit(i, { weight: Number(e.target.value) })} />
                </label>
                <textarea className="input md:col-span-2" rows={1} placeholder="Description / indicateurs observables" value={c.description ?? ""} onChange={(e) => setCrit(i, { description: e.target.value })} />
              </div>
              <div className="flex gap-0.5">
                <button type="button" className="btn-ghost btn-sm" onClick={() => moveCrit(i, -1)}>↑</button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => moveCrit(i, 1)}>↓</button>
                <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => setR({ ...r, criteria: r.criteria.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {c.levels.map((l, k) => (
                <div key={k} className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="flex gap-1">
                    <input className="input px-2 py-1 text-xs font-medium" value={l.label} placeholder="Niveau" onChange={(e) => setLevel(i, k, { label: e.target.value })} />
                    <input type="number" step={0.5} className="input w-16 px-2 py-1 text-xs" value={l.points} onChange={(e) => setLevel(i, k, { points: Number(e.target.value) })} title="Points" />
                    <button type="button" className="text-xs text-slate-400 hover:text-red-600" onClick={() => setCrit(i, { levels: c.levels.filter((_, j) => j !== k) })}>✕</button>
                  </div>
                  <textarea className="input px-2 py-1 text-xs" rows={2} placeholder="Descripteur du niveau" value={l.description ?? ""} onChange={(e) => setLevel(i, k, { description: e.target.value })} />
                </div>
              ))}
              <button
                type="button"
                className="rounded-lg border-2 border-dashed border-slate-200 p-2 text-sm text-slate-500 hover:border-brand-300 hover:text-brand-600"
                onClick={() => setCrit(i, { levels: [...c.levels, { label: "", description: "", points: (c.levels.at(-1)?.points ?? -1) + 1 }] })}
              >
                + Niveau
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setR({ ...r, criteria: [...r.criteria, { title: "", description: "", weight: 1, levels: DEFAULT_LEVELS.map((l) => ({ ...l })) }] })}
        >
          + Ajouter un critère
        </button>
      </section>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Grille enregistrée.</p>}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={save} disabled={pending || locked}>{pending ? "Enregistrement…" : "Enregistrer la grille"}</button>
      </div>
    </div>
  );
}
