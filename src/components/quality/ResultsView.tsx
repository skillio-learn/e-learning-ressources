import type { ResultsBlock } from "@/lib/results";
import { RESULTS_METHODS } from "@/lib/results";

const fmt = (v: number | null, suffix = " %") => (v === null ? "—" : `${v.toLocaleString("fr-FR")}${suffix}`);

/** Indicateurs de résultats publiables : valeurs, effectifs, période et méthodes de calcul. */
export function ResultsView({ r, certifying, note }: { r: ResultsBlock; certifying: { title: string; rncpCode: string | null; certSuccessRate: number | null; certCandidates: number | null; certPeriod: string | null }[]; note?: string | null }) {
  const tiles = [
    { label: "Taux de satisfaction", value: fmt(r.hotSatisfiedRate), hint: `${r.hotCount} répondant(s)${r.hotResponseRate !== null ? `, taux de réponse ${fmt(r.hotResponseRate)}` : ""}` },
    { label: "Note moyenne à chaud", value: fmt(r.hotAverage, " / 5"), hint: `à froid : ${fmt(r.coldAverage, " / 5")} (${r.coldCount} répondant(s))` },
    { label: "Taux de réalisation", value: fmt(r.completionRate), hint: `${r.completed} parcours terminé(s) sur ${r.ended} sortie(s)` },
    { label: "Taux d'abandon", value: fmt(r.abandonRate), hint: `${r.abandoned} abandon(s)` },
    { label: "Taux de réussite", value: fmt(r.successRate), hint: "Certificats de réussite délivrés" },
    { label: "Insertion à 6 mois", value: fmt(r.insertionRate), hint: `${r.insertionAnswered} répondant(s) à l'enquête` },
  ];
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Période : {r.periodLabel} (12 mois glissants) · {r.started} entrée(s) en formation · mis à jour le {new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="card p-5">
            <div className="text-sm text-slate-500">{t.label}</div>
            <div className="mt-1 font-title text-[32px] leading-10 text-brand-600">{t.value}</div>
            <div className="mt-1 text-sm text-slate-500">{t.hint}</div>
          </div>
        ))}
      </div>
      {certifying.length > 0 && (
        <section className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Certification préparée</th><th>Taux d&apos;obtention</th><th>Effectif présenté</th><th>Période</th></tr></thead>
            <tbody>
              {certifying.map((c) => (
                <tr key={c.title}>
                  <td className="font-medium text-slate-900">{c.title}{c.rncpCode ? <span className="block text-sm font-normal text-slate-500">{c.rncpCode} · <a className="link" href={`https://www.francecompetences.fr/recherche/${c.rncpCode.toLowerCase().startsWith("rs") ? "rs" : "rncp"}/${c.rncpCode.replace(/\D/g, "")}/`} target="_blank" rel="noreferrer">fiche France compétences</a></span> : null}</td>
                  <td>{fmt(c.certSuccessRate)}</td>
                  <td>{c.certCandidates ?? "—"}</td>
                  <td>{c.certPeriod ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {note && <p className="whitespace-pre-line text-sm text-slate-700">{note}</p>}
      <section className="card p-5">
        <h2 className="text-xl">Méthodes de calcul</h2>
        <dl className="mt-3 space-y-2 text-sm">
          {RESULTS_METHODS.map((m) => <div key={m.label}><dt className="font-medium text-slate-900">{m.label}</dt><dd className="text-slate-600">{m.method}</dd></div>)}
        </dl>
      </section>
    </div>
  );
}
