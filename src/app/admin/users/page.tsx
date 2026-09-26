import { resetUserMfaAction } from "@/app/actions/mfa";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { createUserAction, deleteUserAction, resetPasswordAction, toggleUserActiveAction, updateUserRoleAction } from "@/app/actions/admin";
import { StateForm } from "@/components/StateForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, PageHeader, Stat } from "@/components/ui";
import { formatDate, ROLE_LABELS } from "@/lib/utils";
import { Trash2 } from "lucide-react";

export const metadata = { title: "Utilisateurs" };
export const dynamic = "force-dynamic";

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const admin = await requireRole("ADMIN");
  const { q, role } = await searchParams;
  const users = await db.user.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
      ...(role && role in ROLE_LABELS ? { role: role as keyof typeof ROLE_LABELS } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { enrollments: true, coursesAuthored: true } }, organization: { select: { name: true } } },
  });
  const orgs = await db.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const counts = await db.user.groupBy({ by: ["role"], _count: true });
  const c = (r: string) => counts.find((x) => x.role === r)?._count ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <PageHeader title="Utilisateurs & rôles" subtitle="Administrateurs, formateurs et apprenants de la plateforme." />
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <Stat label="Super admins" value={c("ADMIN")} />
          <Stat label="Responsables OF" value={c("OF_ADMIN")} />
          <Stat label="Formateurs" value={c("TRAINER")} />
          <Stat label="Apprenants" value={c("LEARNER")} />
        </div>
        <form className="mb-4 flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Nom ou email…" className="input max-w-xs" />
          <select name="role" defaultValue={role ?? ""} className="input w-auto">
            <option value="">Tous les rôles</option>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn-secondary">Filtrer</button>
        </form>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Utilisateur</th><th>Rôle</th><th>Activité</th><th>Dernière connexion</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                  <td>
                    <div className="font-medium">{u.name} {!u.active && <Badge tone="red">Désactivé</Badge>}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                    {u.organization && <div className="text-xs text-brand-700">{u.organization.name}</div>}
                    {u.lockedUntil && u.lockedUntil > new Date() && <Badge tone="red">Verrouillé</Badge>}
                  </td>
                  <td>
                    <form action={updateUserRoleAction.bind(null, u.id)} className="flex gap-1">
                      <select name="role" defaultValue={u.role} className="input w-auto px-2 py-1 text-xs" disabled={u.id === admin.id}>
                        {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <select name="organizationId" defaultValue={u.organizationId ?? ""} className="input w-auto max-w-[140px] px-2 py-1 text-xs" disabled={u.id === admin.id}>
                        <option value="">— Aucun OF —</option>
                        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      {u.id !== admin.id && <button className="btn-ghost btn-sm">OK</button>}
                    </form>
                  </td>
                  <td className="text-xs text-slate-500">
                    {u._count.enrollments} inscription(s)
                    {u._count.coursesAuthored > 0 && <div>{u._count.coursesAuthored} formation(s)</div>}
                  </td>
                  <td className="text-xs text-slate-500">{formatDate(u.lastLoginAt, true)}</td>
                  <td className="whitespace-nowrap">
                    {u.id !== admin.id && (
                      <div className="flex flex-wrap gap-1">
                        <form action={toggleUserActiveAction.bind(null, u.id)}>
                          <button className="btn-ghost btn-sm">{u.active ? "Désactiver" : "Activer"}</button>
                        </form>
                        <StateForm action={resetPasswordAction} submitLabel="Réinit. MDP" submitClassName="btn-ghost btn-sm" className="max-w-[220px]">
                          <input type="hidden" name="userId" value={u.id} />
                        </StateForm>
                        {u.totpEnabledAt && u.role !== "ADMIN" && (
                          <form action={resetUserMfaAction.bind(null, u.id)}>
                            <SubmitButton className="btn-ghost btn-sm" pendingLabel="…" confirm={`Réinitialiser la double authentification de ${u.email} ?`}>Réinit. 2FA</SubmitButton>
                          </form>
                        )}
                        <form action={deleteUserAction.bind(null, u.id)}>
                          <SubmitButton className="btn-ghost btn-sm text-red-600" pendingLabel="…" confirm={`Supprimer définitivement ${u.email} et toutes ses données ?`}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></SubmitButton>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <aside className="space-y-4">
        <div className="card p-4">
          <h2 className="mb-3 text-base">Créer un utilisateur</h2>
          <StateForm action={createUserAction} submitLabel="Créer le compte" submitClassName="btn-primary w-full">
            <input name="name" placeholder="Nom complet" required className="input" />
            <input name="email" type="email" placeholder="Email" required className="input" />
            <select name="role" defaultValue="LEARNER" className="input">
              {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select name="organizationId" defaultValue="" className="input">
              <option value="">— Organisme (obligatoire pour l&apos;équipe OF) —</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <input name="password" type="text" placeholder="Mot de passe (vide = généré)" className="input" />
          </StateForm>
        </div>
        <div className="card space-y-2 p-4 text-sm text-slate-600">
          <h2 className="text-base">Rôles</h2>
          <p><b>Super admin Vylia</b> : gère la plateforme, tous les organismes et tous les comptes.</p>
          <p><b>Responsable OF</b> : gère son organisme : dossiers d&apos;inscription, apprenants, rapports, équipe et paramètres.</p>
          <p><b>Formateur</b> : crée et anime ses formations, quiz et grilles ; corrige et suit ses apprenants.</p>
          <p><b>Apprenant</b> : suit les formations auxquelles il est inscrit, passe les quiz et remet ses devoirs.</p>
        </div>
      </aside>
    </div>
  );
}
