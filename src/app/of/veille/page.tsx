import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { WATCH_CATEGORIES } from "@/lib/qualiopi";
import { ackWatchItemAction } from "@/app/actions/quality";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Container, Empty, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Veille de l'organisme" };
export const dynamic = "force-dynamic";

/** Fiches de veille diffusées à l'équipe : chaque membre confirme sa lecture (preuve de diffusion). */
export default async function TeamWatch() {
  const user = await requireStaff();
  const items = await db.watchItem.findMany({
    where: { organizationId: user.organizationId ?? "__", shareWithTrainers: true },
    orderBy: { createdAt: "desc" },
    include: { acks: { where: { userId: user.id }, select: { ackAt: true } } },
  });
  return (
    <Container className="max-w-4xl">
      <PageHeader title="Veille" subtitle="Informations réglementaires, métiers et pédagogiques partagées par votre organisme. Confirmez votre lecture." />
      <div className="space-y-3">
        {items.length === 0 && <Empty title="Aucune information diffusée pour l'instant" />}
        {items.map((w) => (
          <article key={w.id} className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">{WATCH_CATEGORIES[w.category]?.label ?? w.category}</Badge>
              <span className="text-sm text-slate-500">{formatDate(w.publishedOn ?? w.createdAt)}{w.source ? ` · ${w.source}` : ""}</span>
            </div>
            <h2 className="mt-2 text-lg">{w.title}{w.url && <a href={w.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex text-brand-600" aria-label="Ouvrir la source"><ExternalLink className="h-4 w-4" /></a>}</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{w.summary}</p>
            {w.impact && <p className="mt-2 whitespace-pre-line text-sm"><b>Ce que cela change pour nous :</b> {w.impact}</p>}
            {w.actions && <p className="mt-1 whitespace-pre-line text-sm"><b>Décisions :</b> {w.actions}</p>}
            <div className="mt-3">
              {w.acks[0] ? <Badge tone="green">Lu le {formatDate(w.acks[0].ackAt)}</Badge> : (
                <form action={ackWatchItemAction.bind(null, w.id)}><SubmitButton className="btn-secondary btn-sm">Confirmer ma lecture</SubmitButton></form>
              )}
            </div>
          </article>
        ))}
      </div>
    </Container>
  );
}
