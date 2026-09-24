import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { manageableCoursesWhere } from "@/lib/permissions";
import { createSessionAction } from "@/app/actions/of-admin";
import { StateForm } from "@/components/StateForm";
import { Badge, Container, Empty, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Sessions & émargement" };
export const dynamic = "force-dynamic";

export default async function Sessions() {
  const user = await requireStaff();
  const courses = await db.course.findMany({ where: manageableCoursesWhere(user), select: { id: true, title: true }, orderBy: { title: "asc" } });
  const sessions = await db.trainingSession.findMany({
    where: { courseId: { in: courses.map((c) => c.id) } },
    orderBy: { startDate: "desc" },
    include: { course: { select: { title: true } }, _count: { select: { enrollments: true, applications: true, slots: true } } },
  });
  const now = new Date();
  return (
    <Container>
      <PageHeader title="Sessions de formation & émargement" subtitle="Planifiez les sessions, leurs capacités et les créneaux à émarger (présentiel ou classes virtuelles)." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          {sessions.length === 0 ? (
            <Empty title="Aucune session">Créez une session pour permettre aux candidats de la choisir.</Empty>
          ) : (
            <div className="card overflow-x-auto">
              <table className="table">
                <thead><tr><th>Session</th><th>Formation</th><th>Dates</th><th>Inscrits</th><th>Créneaux</th><th>État</th></tr></thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td><Link href={`/of/sessions/${s.id}`} className="font-medium hover:text-brand-700">{s.name}</Link><div className="text-xs text-slate-500">{s.location ?? ""}</div></td>
                      <td className="text-xs">{s.course.title}</td>
                      <td className="whitespace-nowrap text-xs">{formatDate(s.startDate)} → {formatDate(s.endDate)}</td>
                      <td>{s._count.enrollments}{s.capacity ? ` / ${s.capacity}` : ""} <span className="text-xs text-slate-400">({s._count.applications} dossier(s))</span></td>
                      <td>{s._count.slots}</td>
                      <td>
                        {s.endDate < now ? <Badge>Terminée</Badge> : s.startDate <= now ? <Badge tone="green">En cours</Badge> : <Badge tone="blue">À venir</Badge>}
                        {!s.open && <Badge tone="amber">Fermée</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <aside className="card p-4">
          <h2 className="mb-3 text-base">Nouvelle session</h2>
          <StateForm action={createSessionAction} submitLabel="Créer la session" submitClassName="btn-primary w-full">
            <select name="courseId" required className="input">
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <input name="name" placeholder="Nom (ex : Session octobre 2026)" className="input" />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs"><span className="label">Début</span><input type="date" name="startDate" required className="input" /></label>
              <label className="text-xs"><span className="label">Fin</span><input type="date" name="endDate" required className="input" /></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input name="capacity" type="number" min="1" placeholder="Places" className="input" />
              <input name="location" placeholder="Lieu / À distance" className="input" />
            </div>
          </StateForm>
        </aside>
      </div>
    </Container>
  );
}
