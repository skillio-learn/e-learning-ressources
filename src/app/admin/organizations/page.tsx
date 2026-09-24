import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { createOrganizationAction, toggleOrganizationAction } from "@/app/actions/admin";
import { StateForm } from "@/components/StateForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, PageHeader } from "@/components/ui";

export const metadata = { title: "Organismes de formation" };
export const dynamic = "force-dynamic";

export default async function Organizations() {
  await requireRole("ADMIN");
  const orgs = await db.organization.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { courses: true, users: true } } },
  });
  const learners = await db.enrollment.groupBy({ by: ["courseId"], _count: true });
  const courseOrg = await db.course.findMany({ select: { id: true, organizationId: true } });
  const orgOfCourse = new Map(courseOrg.map((c) => [c.id, c.organizationId]));
  const enrByOrg = new Map<string, number>();
  learners.forEach((l) => {
    const o = orgOfCourse.get(l.courseId);
    if (o) enrByOrg.set(o, (enrByOrg.get(o) ?? 0) + l._count);
  });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <PageHeader title="Organismes de formation" subtitle="Chaque OF dispose de son espace, de son équipe, de ses formations et de ses apprenants." />
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Organisme</th><th>NDA / Qualiopi</th><th>Formations</th><th>Comptes</th><th>Inscriptions</th><th>Lien d&apos;inscription</th><th></th></tr></thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className={o.active ? "" : "opacity-60"}>
                  <td>
                    <Link href={`/admin/organizations/${o.id}`} className="font-medium hover:text-brand-700">{o.name}</Link>
                    <div className="text-xs text-slate-500">{o.city ?? ""} {o.siret ? `· SIRET ${o.siret}` : ""}</div>
                  </td>
                  <td className="text-xs">{o.nda ?? <span className="text-amber-600">NDA manquant</span>}<br />{o.qualiopiNumber ?? <span className="text-slate-400">—</span>}</td>
                  <td>{o._count.courses}</td>
                  <td>{o._count.users}</td>
                  <td>{enrByOrg.get(o.id) ?? 0}</td>
                  <td className="text-xs"><code>/register?of={o.slug}</code></td>
                  <td className="whitespace-nowrap">
                    {!o.active && <Badge tone="red">Désactivé</Badge>}
                    <form action={toggleOrganizationAction.bind(null, o.id)} className="inline">
                      <SubmitButton className="btn-ghost btn-sm" pendingLabel="…">{o.active ? "Désactiver" : "Activer"}</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <aside className="card p-4">
        <h2 className="mb-3 text-base">Nouvel organisme</h2>
        <StateForm action={createOrganizationAction} submitLabel="Créer l'organisme" submitClassName="btn-primary w-full">
          <input name="name" placeholder="Nom de l'OF" required className="input" />
          <input name="email" type="email" placeholder="Email de contact" className="input" />
          <div className="border-t border-slate-100 pt-2 text-xs font-semibold text-slate-500">Responsable de l&apos;OF (facultatif)</div>
          <input name="managerName" placeholder="Nom du responsable" className="input" />
          <input name="managerEmail" type="email" placeholder="Email du responsable" className="input" />
        </StateForm>
      </aside>
    </div>
  );
}
