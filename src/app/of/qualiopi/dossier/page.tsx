import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { createAuditorAccessAction, revokeAuditorAccessAction } from "@/app/actions/quality";
import { AuditorLinkForm } from "@/components/quality/AuditorLinkForm";
import { DossierView } from "@/components/quality/DossierView";
import { PrintButton } from "@/components/PrintButton";
import { Badge, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Dossier d'audit" };
export const dynamic = "force-dynamic";

export default async function Dossier() {
  const user = await requireStaff();
  const orgId = user.organizationId!;
  const links = await db.auditorAccess.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 10 });
  return (
    <>
      <PageHeader title="Dossier d'audit" subtitle="Toutes vos preuves, rangées par critère et par indicateur. Imprimez-le ou enregistrez-le en PDF, ou ouvrez un accès temporaire en lecture seule à votre auditeur." actions={<PrintButton label="Imprimer / PDF" />} />
      <section className="no-print card mb-8 p-6">
        <h2 className="text-xl">Accès auditeur</h2>
        <p className="mt-1 text-sm text-slate-500">Lien personnel, en lecture seule, valable de 1 à 30 jours. Chaque consultation est tracée ; vous pouvez révoquer le lien à tout moment.</p>
        <div className="mt-4"><AuditorLinkForm action={createAuditorAccessAction} /></div>
        {links.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {links.map((l) => {
              const active = !l.revokedAt && l.expiresAt > new Date();
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">{l.label} · créé le {formatDate(l.createdAt)} · expire le {formatDate(l.expiresAt)}{l.lastUsedAt ? ` · dernière consultation le ${formatDate(l.lastUsedAt, true)}` : " · jamais consulté"}</span>
                  <Badge tone={active ? "green" : "gray"}>{active ? "Actif" : l.revokedAt ? "Révoqué" : "Expiré"}</Badge>
                  {active && <form action={revokeAuditorAccessAction.bind(null, l.id)}><button className="btn-ghost btn-sm text-red-600">Révoquer</button></form>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <DossierView orgId={orgId} />
    </>
  );
}
