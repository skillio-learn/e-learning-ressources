import Link from "next/link";
import { db } from "@/lib/db";
import { isOfManager, requireStaff } from "@/lib/auth";
import { manageableCoursesWhere } from "@/lib/permissions";
import { createSessionAction } from "@/app/actions/of-admin";
import { StateForm } from "@/components/StateForm";
import { SessionFields } from "@/components/of/SessionFields";
import { Badge, Container, Empty, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Sessions & émargement" };
export const dynamic = "force-dynamic";

export default async function Sessions() {
  const user = await requireStaff();
  const manager = isOfManager(user);
  const courses = await db.course.findMany({ where: manageableCoursesWhere(user), select: { id: true, title: true }, orderBy: { title: "asc" } });
  const sessions = await db.trainingSession.findMany({
    where: { courseId: { in: courses.map((c) => c.id) } },
    orderBy: { startDate: "desc" },
    include: { course: { select: { title: true } }, company: { select: { name: true } }, _count: { select: { enrollments: true, applications: true, slots: true } } },
  });
  const orgId = user.organizationId ?? "__";
  const [companies, team] = await Promise.all([
    db.company.findMany({ where: { organizationId: orgId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { organizationId: orgId, role: { in: ["OF_ADMIN", "TRAINER"] }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const now = new Date();
  return (
    <Container>
      <PageHeader title="Sessions de formation & émargement" subtitle="Planifiez les sessions, leurs capacités et les créneaux à émarger (présentiel ou classes virtuelles)." />
      <p className="mb-6 rounded-[10px] bg-brand-50 p-4 text-sm text-brand-700">
        <b className="font-medium">Émargement synchrone ou asynchrone.</b> Créez des créneaux uniquement pour les temps synchrones (salle, classe virtuelle à heure fixe) :
        stagiaires et formateur y signent chaque demi-journée. Les parties à distance en autonomie (FOAD asynchrone) n&apos;ont pas de créneau : la plateforme enregistre
        automatiquement le temps d&apos;activité réel de chaque stagiaire, restitué dans le relevé de connexions et le certificat de réalisation.
      </p>
      <div className={manager ? "grid gap-6 xl:grid-cols-[1fr_420px]" : ""}>
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
                      <td>
                        <Link href={`/of/sessions/${s.id}`} className="font-medium hover:text-brand-700">{s.name}</Link>
                        <div className="text-xs text-slate-500">{s.format === "INTRA" ? `Intra · ${s.company?.name ?? "entreprise à préciser"}` : "Inter-entreprises"}{s.location ? ` · ${s.location}` : ""}</div>
                      </td>
                      <td className="text-xs">{s.course.title}</td>
                      <td className="whitespace-nowrap text-xs">{formatDate(s.startDate)} au {formatDate(s.endDate)}</td>
                      <td>{s._count.enrollments}{s.capacity ? ` / ${s.capacity}` : ""} <span className="text-xs text-slate-500">({s._count.applications} dossier(s))</span></td>
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
        {manager && <aside className="card p-5">
          <h2 className="mb-3 text-xl">Nouvelle session</h2>
          <StateForm action={createSessionAction} submitLabel="Créer la session" submitClassName="btn-primary w-full" className="space-y-3">
            <label className="block"><span className="label">Formation</span>
              <select name="courseId" required className="input">
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <SessionFields companies={companies} team={team} />
          </StateForm>
        </aside>}
      </div>
    </Container>
  );
}
