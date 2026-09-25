import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { createTeamMemberAction, setTeamMemberAction } from "@/app/actions/of-admin";
import { OrganizationForm } from "@/components/of/OrganizationForm";
import { StateForm } from "@/components/StateForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, PageHeader } from "@/components/ui";
import { TICKET_STATUS } from "@/lib/labels";
import { ROLE_LABELS, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOrganization({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("ADMIN");
  const [org, members, tickets] = await Promise.all([
    db.organization.findUnique({ where: { id } }),
    db.user.findMany({
      where: { organizationId: id, role: { in: ["OF_ADMIN", "TRAINER"] } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true },
    }),
    db.supportTicket.findMany({ where: { organizationId: id }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, number: true, subject: true, status: true, createdAt: true } }),
  ]);
  if (!org) notFound();
  const managers = members.filter((m) => m.role === "OF_ADMIN" && m.active);

  return (
    <div className="space-y-8">
      <PageHeader back={{ href: "/admin/organizations", label: "Organismes" }} title={org.name} subtitle={[org.city, org.email, org.phone].filter(Boolean).join(" · ")} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card overflow-x-auto">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2>Équipe de l&apos;organisme</h2>
            <span className="text-xs text-slate-500">{members.length} membre(s)</span>
          </div>
          <table className="table mt-2">
            <thead><tr><th>Membre</th><th>Rôle</th><th>Dernière connexion</th><th></th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className={m.active ? "" : "opacity-60"}>
                  <td>
                    <div className="font-medium">{m.name}{org.supportReferentId === m.id && <span className="ml-2"><Badge tone="purple">Référent support</Badge></span>}</div>
                    <div className="text-xs text-slate-500">{m.email}</div>
                  </td>
                  <td><Badge tone={m.role === "OF_ADMIN" ? "purple" : "blue"}>{ROLE_LABELS[m.role]}</Badge>{!m.active && <Badge tone="red">Désactivé</Badge>}</td>
                  <td className="text-xs">{formatDate(m.lastLoginAt, true)}</td>
                  <td className="whitespace-nowrap text-right">
                    <form action={setTeamMemberAction.bind(null, m.id, { role: m.role === "OF_ADMIN" ? "TRAINER" : "OF_ADMIN" })} className="inline">
                      <SubmitButton className="btn-ghost btn-sm" pendingLabel="…">{m.role === "OF_ADMIN" ? "Passer formateur" : "Passer responsable"}</SubmitButton>
                    </form>
                    <form action={setTeamMemberAction.bind(null, m.id, { active: !m.active })} className="inline">
                      <SubmitButton className="btn-ghost btn-sm" pendingLabel="…">{m.active ? "Désactiver" : "Réactiver"}</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td colSpan={4} className="text-center text-sm text-slate-400">Aucun membre : créez le compte du responsable de l&apos;organisme.</td></tr>
              )}
            </tbody>
          </table>
        </section>
        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 text-base">Ajouter un membre</h2>
            <StateForm action={createTeamMemberAction.bind(null, org.id)} submitLabel="Créer / rattacher" submitClassName="btn-primary w-full">
              <input name="name" placeholder="Nom complet" required className="input" />
              <input name="email" type="email" placeholder="Email" required className="input" />
              <select name="role" className="input" defaultValue="OF_ADMIN">
                <option value="OF_ADMIN">Responsable OF</option>
                <option value="TRAINER">Formateur</option>
              </select>
            </StateForm>
          </div>
          <div className="card p-5 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base">Tickets support</h2>
              <Link href={`/admin/support?org=${org.id}&tab=closed`} className="link text-xs">Historique</Link>
            </div>
            {tickets.length === 0 ? (
              <p className="text-slate-400">Aucun ticket.</p>
            ) : (
              <ul className="space-y-1.5">
                {tickets.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/support/${t.id}`} className="link truncate">{t.number} · {t.subject}</Link>
                    <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <div className="max-w-4xl">
        <OrganizationForm org={org} managers={managers} />
      </div>
    </div>
  );
}
