import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { createTaskAction, deleteTaskAction, toggleTaskAction } from "@/app/actions/tasks";
import { StateForm } from "@/components/StateForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Container, Empty, Field, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Tâches et relances" };
export const dynamic = "force-dynamic";

export default async function Tasks({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue = "miennes" } = await searchParams;
  const user = await requireStaff();
  const orgId = user.organizationId ?? "__";
  const where = { organizationId: orgId, ...(vue === "miennes" ? { assigneeId: user.id } : {}), ...(vue === "terminees" ? { status: "DONE" as const } : { status: "OPEN" as const }) };
  const [tasks, team] = await Promise.all([
    db.task.findMany({ where, orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 200, include: { assignee: { select: { name: true } }, createdBy: { select: { name: true } } } }),
    db.user.findMany({ where: { organizationId: orgId, role: { in: ["OF_ADMIN", "TRAINER"] }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const now = new Date();
  const tabs = [["miennes", "Mes tâches"], ["equipe", "Toute l'équipe"], ["terminees", "Terminées"]] as const;
  return (
    <Container>
      <PageHeader title="Tâches et relances" subtitle="Organisez le suivi : relancer un apprenant, préparer une session, traiter une réclamation. Les tâches en retard sont rappelées chaque matin." />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([k, l]) => <Link key={k} href={`/of/tasks?vue=${k}`} className={k === vue ? "btn-secondary btn-sm" : "btn-ghost btn-sm"}>{l}</Link>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div>
          {tasks.length === 0 ? <Empty title="Aucune tâche">Tout est à jour.</Empty> : (
            <ul className="card divide-y divide-slate-100">
              {tasks.map((t) => {
                const late = t.status === "OPEN" && t.dueAt && t.dueAt < now;
                return (
                  <li key={t.id} className="flex flex-wrap items-start gap-3 p-4">
                    <form action={toggleTaskAction.bind(null, t.id)}>
                      <button className={`mt-0.5 grid h-5 w-5 place-items-center rounded border ${t.status === "DONE" ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"}`} aria-label={t.status === "DONE" ? "Rouvrir la tâche" : "Marquer comme terminée"}>
                        {t.status === "DONE" ? "✓" : ""}
                      </button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <div className={`font-medium ${t.status === "DONE" ? "text-slate-400 line-through" : "text-slate-900"}`}>{t.title}</div>
                      {t.notes && <p className="whitespace-pre-line text-sm text-slate-600">{t.notes}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {t.priority === "HIGH" && <Badge tone="red">Prioritaire</Badge>}
                        {t.dueAt && <Badge tone={late ? "red" : "gray"}>{late ? "En retard · " : ""}échéance {formatDate(t.dueAt)}</Badge>}
                        <span>Pour {t.assignee?.name ?? "—"}{t.createdBy && t.createdBy.name !== t.assignee?.name ? ` · par ${t.createdBy.name}` : ""}</span>
                        {t.link && <Link href={t.link} className="link">{t.linkLabel || "Ouvrir"}</Link>}
                      </div>
                    </div>
                    <form action={deleteTaskAction.bind(null, t.id)}><SubmitButton className="btn-ghost btn-sm" confirm="Supprimer cette tâche ?">Supprimer</SubmitButton></form>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <aside className="card p-5">
          <h2 className="mb-3 text-xl">Nouvelle tâche</h2>
          <StateForm action={createTaskAction} submitLabel="Créer la tâche" submitClassName="btn-primary w-full" className="space-y-3">
            <Field label="Intitulé"><input name="title" required className="input" placeholder="Ex. : relancer Julie pour son devoir" /></Field>
            <Field label="Détails"><textarea name="notes" rows={3} className="input" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Échéance"><input type="date" name="dueAt" className="input" /></Field>
              <Field label="Priorité"><select name="priority" className="input"><option value="NORMAL">Normale</option><option value="HIGH">Prioritaire</option></select></Field>
            </div>
            <Field label="Attribuée à"><select name="assigneeId" defaultValue={user.id} className="input">{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
            <Field label="Lien interne (facultatif)"><input name="link" className="input" placeholder="/of/learners/…" /></Field>
          </StateForm>
        </aside>
      </div>
    </Container>
  );
}
