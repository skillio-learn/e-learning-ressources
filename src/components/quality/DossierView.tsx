import { db } from "@/lib/db";
import { indicatorBoard } from "@/lib/qualiopi-evidence";
import { CRITERIA, INDICATOR_STATUS } from "@/lib/qualiopi";
import { formatDate } from "@/lib/utils";

/**
 * Dossier de preuves par indicateur : statut, validation, preuves automatiques et déposées.
 * Affiché à l'OF (impression) et à l'auditeur (lien temporaire en lecture seule, `token`).
 */
export async function DossierView({ orgId, token }: { orgId: string; token?: string }) {
  const [org, { rows, version }, evidences, sample] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true, legalName: true, siret: true, nda: true, qualiopiNumber: true, qualiopiCertifier: true, qualiopiScope: true } }),
    indicatorBoard(orgId),
    db.qualityEvidence.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, select: { id: true, code: true, title: true, description: true, url: true, fileName: true, createdAt: true } }),
    // Échantillon de dossiers apprenants récents, tiré au hasard
    db.enrollment.findMany({
      where: { course: { organizationId: orgId }, status: { in: ["COMPLETED", "ABANDONED"] } },
      orderBy: { enrolledAt: "desc" }, take: 40,
      select: { id: true, status: true, startDate: true, endDate: true, completedAt: true, exitDate: true, conventionSignedAt: true, user: { select: { name: true } }, course: { select: { title: true } }, _count: { select: { satisfactions: true, documents: true } } },
    }).then((xs) => xs.sort(() => Math.random() - 0.5).slice(0, 5)),
  ]);
  const q = token ? `?t=${encodeURIComponent(token)}` : "";
  return (
    <div className="space-y-8">
      <section className="card p-6 text-sm">
        <h2 className="text-xl">{org.legalName ?? org.name}</h2>
        <p className="mt-1 text-slate-600">
          {[org.siret && `SIRET ${org.siret}`, org.nda && `NDA ${org.nda}`, org.qualiopiNumber && `Qualiopi n° ${org.qualiopiNumber}`, org.qualiopiCertifier].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 text-slate-600">Référentiel {version === "2026" ? "national qualité 2026 (décret n° 2026-728)" : "national qualité 2019"} · dossier édité le {formatDate(new Date(), true)}</p>
      </section>
      {CRITERIA.map((c) => (
        <section key={c.n}>
          <h2 className="mb-3 text-2xl">Critère {c.n} · {c.title}</h2>
          <div className="space-y-3">
            {rows.filter((r) => r.ind.criterion === c.n).map((r) => {
              const ev = evidences.filter((e) => e.code === r.ind.code);
              const st = INDICATOR_STATUS[r.status as keyof typeof INDICATOR_STATUS] ?? INDICATOR_STATUS.TODO;
              return (
                <article key={r.ind.code} className="card break-inside-avoid p-5 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base">Indicateur {r.ind.code} · {r.ind.title}</h3>
                    <span className="text-slate-500">{!r.applicable ? `Non applicable : ${r.notApplicableReason ?? "—"}` : `${st.label}${r.validatedAt ? ` le ${formatDate(r.validatedAt)}` : ""}`}</span>
                  </div>
                  {r.applicable && (
                    <>
                      {r.comment && <p className="mt-2 whitespace-pre-line text-slate-700">{r.comment}</p>}
                      {r.auto && <ul className="mt-2 list-disc space-y-0.5 pl-5 text-slate-600">{r.auto.facts.map((f) => <li key={f}>{f}</li>)}</ul>}
                      {ev.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {ev.map((e) => (
                            <li key={e.id}>
                              <span className="font-medium text-slate-900">{e.title}</span> <span className="text-slate-500">({formatDate(e.createdAt)})</span>
                              {e.fileName && <> · <a className="link" href={`/api/quality/evidence/${e.id}${q}`}>{e.fileName}</a></>}
                              {e.url && <> · <a className="link" href={e.url} target="_blank" rel="noreferrer">lien</a></>}
                              {e.description && <span className="block whitespace-pre-line text-slate-600">{e.description}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
      <section className="break-inside-avoid">
        <h2 className="mb-3 text-2xl">Échantillon de dossiers apprenants</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Apprenant</th><th>Formation</th><th>Période</th><th>Issue</th><th>Convention</th><th>Pièces</th><th>Avis</th></tr></thead>
            <tbody>
              {sample.map((e) => (
                <tr key={e.id}>
                  <td>{e.user.name}</td><td>{e.course.title}</td>
                  <td className="whitespace-nowrap">{formatDate(e.startDate)} au {formatDate(e.endDate)}</td>
                  <td>{e.status === "COMPLETED" ? `Terminé le ${formatDate(e.completedAt)}` : `Abandon le ${formatDate(e.exitDate)}`}</td>
                  <td>{e.conventionSignedAt ? `Signée le ${formatDate(e.conventionSignedAt)}` : "—"}</td>
                  <td>{e._count.documents}</td><td>{e._count.satisfactions}</td>
                </tr>
              ))}
              {!sample.length && <tr><td colSpan={7} className="text-slate-500">Aucun parcours clôturé.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
