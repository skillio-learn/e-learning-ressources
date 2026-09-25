import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { createTeamMemberAction, setTeamMemberAction } from "@/app/actions/of-admin";
import { StateForm } from "@/components/StateForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Container, PageHeader } from "@/components/ui";
import { ROLE_LABELS, formatDate } from "@/lib/utils";

export const metadata = { title: "Équipe" };
export const dynamic = "force-dynamic";

export default async function Team({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const user = await requireOfManager();
  const { org } = await searchParams;
  const orgs = user.role === "ADMIN" ? await db.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const orgId = user.role === "ADMIN" ? org ?? orgs[0]?.id : user.organizationId;
  if (!orgId) return <Container><p>Aucun organisme.</p></Container>;
  const members = await db.user.findMany({
    where: { organizationId: orgId, role: { in: ["OF_ADMIN", "TRAINER"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { _count: { select: { coursesAuthored: true } } },
  });
  return (
    <Container>
      <PageHeader title="Équipe de l'organisme" subtitle="Responsables (gestion administrative, dossiers, rapports) et formateurs (contenus, corrections)." />
      {user.role === "ADMIN" && (
        <form className="mb-4 flex gap-2">
          <select name="org" defaultValue={orgId} className="input max-w-xs">
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button className="btn-secondary">Afficher</button>
        </form>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Membre</th><th>Rôle</th><th>Formations</th><th>Dernière connexion</th><th></th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className={m.active ? "" : "opacity-60"}>
                  <td><div className="font-medium">{m.name}</div><div className="text-xs text-slate-500">{m.email}</div></td>
                  <td><Badge tone={m.role === "OF_ADMIN" ? "purple" : "blue"}>{ROLE_LABELS[m.role]}</Badge>{!m.active && <Badge tone="red">Désactivé</Badge>}</td>
                  <td>{m._count.coursesAuthored}</td>
                  <td className="text-xs">{formatDate(m.lastLoginAt, true)}</td>
                  <td className="whitespace-nowrap text-right">
                    {m.id !== user.id && (
                      <>
                        <form action={setTeamMemberAction.bind(null, m.id, { role: m.role === "OF_ADMIN" ? "TRAINER" : "OF_ADMIN" })} className="inline">
                          <SubmitButton className="btn-ghost btn-sm" pendingLabel="…">{m.role === "OF_ADMIN" ? "Passer formateur" : "Passer responsable"}</SubmitButton>
                        </form>
                        <form action={setTeamMemberAction.bind(null, m.id, { active: !m.active })} className="inline">
                          <SubmitButton className="btn-ghost btn-sm" pendingLabel="…">{m.active ? "Désactiver" : "Réactiver"}</SubmitButton>
                        </form>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="card p-4">
          <h2 className="mb-3 text-base">Ajouter un membre</h2>
          <StateForm action={createTeamMemberAction.bind(null, orgId)} submitLabel="Créer / rattacher" submitClassName="btn-primary w-full">
            <input name="name" placeholder="Nom complet" required className="input" />
            <input name="email" type="email" placeholder="Email" required className="input" />
            <select name="role" className="input" defaultValue="TRAINER">
              <option value="TRAINER">Formateur</option>
              <option value="OF_ADMIN">Responsable OF</option>
            </select>
          </StateForm>
        </aside>
      </div>
    </Container>
  );
}
