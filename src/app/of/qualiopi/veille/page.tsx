import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { WATCH_CATEGORIES } from "@/lib/qualiopi";
import { addWatchItemAction, deleteWatchItemAction } from "@/app/actions/quality";
import { StateForm } from "@/components/StateForm";
import { Badge, Empty, Field, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Veille" };
export const dynamic = "force-dynamic";

export default async function Watch() {
  const user = await requireStaff();
  const orgId = user.organizationId!;
  const [items, team] = await Promise.all([
    db.watchItem.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, include: { acks: { select: { userId: true } } } }),
    db.user.count({ where: { organizationId: orgId, role: { in: ["OF_ADMIN", "TRAINER"] }, active: true } }),
  ]);
  return (
    <>
      <PageHeader title="Veille" subtitle="Indicateurs 23 à 25 (et 26 pour le handicap) : ce qui compte, c'est l'exploitation. Pour chaque information, notez l'impact pour votre organisme et les décisions prises, puis diffusez-la à l'équipe." />
      <details className="card p-6" open={!items.length}>
        <summary className="cursor-pointer text-xl text-brand-600">Nouvelle fiche de veille</summary>
        <StateForm action={addWatchItemAction} submitLabel="Enregistrer la fiche" submitClassName="btn-primary" className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type de veille"><select name="category" className="input">{Object.entries(WATCH_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label} (ind. {v.indicator})</option>)}</select></Field>
            <Field label="Source"><input name="source" className="input" placeholder="Centre Inffo, Légifrance, OPCO…" /></Field>
            <Field label="Date de publication"><input type="date" name="publishedOn" className="input" /></Field>
          </div>
          <Field label="Titre"><input name="title" required maxLength={200} className="input" placeholder="Ex. Décret 2026-728 : nouveau référentiel qualité" /></Field>
          <Field label="Lien (https)"><input name="url" type="url" className="input" /></Field>
          <Field label="Résumé"><textarea name="summary" required rows={3} className="input" /></Field>
          <Field label="Impact pour notre organisme"><textarea name="impact" rows={2} className="input" /></Field>
          <Field label="Décisions et actions prises"><textarea name="actions" rows={2} className="input" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="shareWithTrainers" defaultChecked className="h-4 w-4" /> Diffuser à l&apos;équipe (chaque membre confirme sa lecture)</label>
        </StateForm>
      </details>
      <div className="mt-6 space-y-3">
        {items.length === 0 && <Empty title="Aucune fiche de veille">Visez au moins une fiche par trimestre et par type de veille.</Empty>}
        {items.map((w) => (
          <article key={w.id} className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">{WATCH_CATEGORIES[w.category]?.label ?? w.category}</Badge>
              <span className="text-sm text-slate-500">{formatDate(w.publishedOn ?? w.createdAt)}{w.source ? ` · ${w.source}` : ""}</span>
              {w.shareWithTrainers && <span className="ml-auto text-sm text-slate-500">Lu par {w.acks.length}/{team} membre(s)</span>}
            </div>
            <h3 className="mt-2 text-lg">{w.title}{w.url && <a href={w.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex text-brand-600" aria-label="Ouvrir la source"><ExternalLink className="h-4 w-4" /></a>}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{w.summary}</p>
            {w.impact && <p className="mt-2 whitespace-pre-line text-sm"><b>Impact :</b> {w.impact}</p>}
            {w.actions ? <p className="mt-1 whitespace-pre-line text-sm"><b>Décisions :</b> {w.actions}</p> : <p className="mt-2 text-sm text-red-600">Exploitation non renseignée : indiquez la décision prise.</p>}
            <form action={deleteWatchItemAction.bind(null, w.id)} className="mt-3"><button className="btn-ghost btn-sm text-red-600">Supprimer</button></form>
          </article>
        ))}
      </div>
    </>
  );
}
