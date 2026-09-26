import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { requestAccommodationAction, updateAccommodationAction } from "@/app/actions/quality";
import { StateForm } from "@/components/StateForm";
import { Badge, Empty, Field, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Registre handicap" };
export const dynamic = "force-dynamic";

const STATUS = {
  REQUESTED: { label: "Demande reçue", tone: "red" },
  ANALYSING: { label: "En analyse", tone: "gray" },
  IN_PLACE: { label: "Aménagements en place", tone: "green" },
  ORIENTED: { label: "Orientée vers un partenaire", tone: "blue" },
  CLOSED: { label: "Clôturée", tone: "gray" },
} as const;
const PARTNERS = ["Agefiph", "FIPHFP", "Cap emploi", "MDPH", "Médecine du travail", "Ressource handicap formation (RHF)", "Référent handicap de l'OPCO"];

export default async function HandicapRegister() {
  const user = await requireStaff();
  const orgId = user.organizationId!;
  const [org, items, flagged] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { referentHandicap: true, handicapReferent: { select: { name: true, email: true } } } }),
    db.accommodation.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true } }, enrollment: { select: { course: { select: { title: true } } } }, handledBy: { select: { name: true } } } }),
    db.user.findMany({ where: { organizationId: orgId, role: "LEARNER", profile: { disability: true } }, select: { id: true, name: true, profile: { select: { disabilityNeeds: true } } } }),
  ]);
  const withoutRecord = flagged.filter((f) => !items.some((i) => i.userId === f.id));
  const referent = org.handicapReferent ? `${org.handicapReferent.name} (${org.handicapReferent.email})` : org.referentHandicap;

  return (
    <>
      <PageHeader title="Registre handicap" subtitle="Indicateur 26 : chaque demande est tracée, analysée avec la personne, puis donne lieu à des aménagements ou à une orientation vers un partenaire spécialisé. Les données sont confidentielles." />
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="card p-5 text-sm">
          <div className="text-slate-500">Référent handicap</div>
          <div className="mt-1 font-medium text-slate-900">{referent ?? <span className="text-red-600">Non désigné</span>}</div>
          <Link href="/of/qualiopi/parametres" className="link mt-2 inline-block">Modifier</Link>
        </div>
        <div className="card p-5 text-sm">
          <div className="text-slate-500">Situations déclarées dans les dossiers sans suivi au registre</div>
          <div className="mt-1 font-title text-2xl text-brand-600">{withoutRecord.length}</div>
        </div>
      </div>

      {withoutRecord.length > 0 && (
        <section className="card mb-6 p-5">
          <h2 className="text-xl">À ouvrir au registre</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {withoutRecord.map((f) => (
              <li key={f.id} className="py-3">
                <div className="font-medium text-slate-900">{f.name}</div>
                <StateForm action={requestAccommodationAction} submitLabel="Ouvrir le suivi" submitClassName="btn-secondary btn-sm" className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="userId" value={f.id} />
                  <input name="need" defaultValue={f.profile?.disabilityNeeds ?? "Situation de handicap déclarée dans le dossier"} className="input min-w-[16rem] flex-1" />
                </StateForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-3">
        {items.length === 0 && <Empty title="Aucune demande au registre">Les apprenants peuvent formuler une demande depuis leur profil.</Empty>}
        {items.map((a) => {
          const st = STATUS[a.status as keyof typeof STATUS] ?? STATUS.REQUESTED;
          return (
            <details key={a.id} className="card p-5">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-900">{a.user.name}</span>
                  <span className="text-sm text-slate-500">{formatDate(a.createdAt)}{a.enrollment ? ` · ${a.enrollment.course.title}` : ""} · {a.requestedBy === "LEARNER" ? "demande de l'apprenant" : "saisie par l'équipe"}</span>
                </span>
                <Badge tone={st.tone}>{st.label}</Badge>
              </summary>
              <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm">{a.need}</p>
              <StateForm action={updateAccommodationAction.bind(null, a.id)} submitLabel="Mettre à jour" submitClassName="btn-primary" className="mt-4 space-y-3">
                <Field label="Statut"><select name="status" defaultValue={a.status} className="input">{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
                <Field label="Aménagements décidés (rythme, supports, évaluation, accès…)"><textarea name="measures" rows={3} defaultValue={a.measures ?? ""} className="input" /></Field>
                <fieldset>
                  <legend className="label">Partenaires mobilisés</legend>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {PARTNERS.map((p) => <label key={p} className="flex items-center gap-2 text-sm"><input type="checkbox" name="partners" value={p} defaultChecked={a.partners.includes(p)} className="h-4 w-4" /> {p}</label>)}
                  </div>
                </fieldset>
                {a.handledBy && <p className="text-sm text-slate-500">Dernière mise à jour par {a.handledBy.name}{a.decidedAt ? `, décision le ${formatDate(a.decidedAt)}` : ""}.</p>}
              </StateForm>
            </details>
          );
        })}
      </div>
    </>
  );
}
