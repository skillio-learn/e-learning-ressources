import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { indicatorBoard } from "@/lib/qualiopi-evidence";
import { CRITERIA, INDICATOR_STATUS } from "@/lib/qualiopi";
import { Badge, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Indicateurs Qualiopi" };
export const dynamic = "force-dynamic";

const DOT = { ok: "bg-emerald-600", partial: "bg-brand-600", missing: "bg-red-600", info: "bg-slate-400" } as const;
const DOT_LABEL = { ok: "Preuves automatiques présentes", partial: "Preuves automatiques partielles", missing: "Aucune preuve automatique", info: "Sans objet ou à documenter" } as const;

export default async function Indicators() {
  const user = await requireStaff();
  const { rows, version } = await indicatorBoard(user.organizationId!);
  return (
    <>
      <PageHeader title="Indicateurs" subtitle={`${rows.length} indicateurs (référentiel ${version}). Ouvrez un indicateur pour voir ce qui est attendu, les preuves déjà disponibles et le valider.`} />
      <div className="space-y-6">
        {CRITERIA.map((c) => (
          <section key={c.n} id={`critere-${c.n}`} className="card overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 className="text-xl">Critère {c.n} · {c.title}</h2>
              <p className="text-sm text-slate-500">{c.hint}</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {rows.filter((r) => r.ind.criterion === c.n).map((r) => {
                const st = INDICATOR_STATUS[r.status as keyof typeof INDICATOR_STATUS] ?? INDICATOR_STATUS.TODO;
                return (
                  <li key={r.ind.code}>
                    <Link href={`/of/qualiopi/indicateurs/${r.ind.code}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-sm font-medium text-brand-600">{r.ind.code}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-slate-900">{r.ind.title}</span>
                        <span className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                          {r.auto && <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${DOT[r.auto.level]}`} />{DOT_LABEL[r.auto.level]}</span>}
                          <span>{r.evidenceCount} preuve(s) déposée(s)</span>
                          {r.ind.changed2026 && version === "2026" && <span className="text-brand-600">Évolution 2026</span>}
                        </span>
                      </span>
                      {!r.applicable ? (
                        <Badge>Non applicable</Badge>
                      ) : r.stale ? (
                        <Badge tone="red">À revoir (validé le {formatDate(r.validatedAt)})</Badge>
                      ) : (
                        <Badge tone={st.tone}>{st.label}{r.status === "VALIDATED" && r.validatedAt ? ` le ${formatDate(r.validatedAt)}` : ""}</Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
