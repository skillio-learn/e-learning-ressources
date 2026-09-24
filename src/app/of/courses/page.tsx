import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { manageableCoursesWhere } from "@/lib/permissions";
import { Badge, Container, Empty, PageHeader } from "@/components/ui";
import { formatDate, STATUS_LABELS } from "@/lib/utils";

export const metadata = { title: "Espace formateur" };
export const dynamic = "force-dynamic";

export default async function TrainerCourses() {
  const user = await requireRole("ADMIN", "OF_ADMIN", "TRAINER");
  const courses = await db.course.findMany({
    where: manageableCoursesWhere(user),
    orderBy: { updatedAt: "desc" },
    include: {
      author: { select: { name: true } },
      _count: { select: { modules: true, enrollments: true } },
      modules: { select: { _count: { select: { lessons: true } } } },
    },
  });
  return (
    <Container>
      <PageHeader
        title="Mes formations"
        subtitle={user.role === "ADMIN" ? "Toutes les formations de la plateforme." : "Formations dont vous êtes auteur ou co-formateur."}
        actions={<Link href="/of/courses/new" className="btn-primary">+ Nouvelle formation</Link>}
      />
      {courses.length === 0 ? (
        <Empty title="Aucune formation">
          <Link href="/of/courses/new" className="text-brand-600 hover:underline">Créer ma première formation</Link>
        </Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Formation</th><th>Statut</th><th>Modules</th><th>Leçons</th><th>Inscrits</th><th>Auteur</th><th>Mise à jour</th></tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td>
                    <Link href={`/of/courses/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">{c.title}</Link>
                    {c.category && <div className="text-xs text-slate-500">{c.category}</div>}
                  </td>
                  <td>
                    <Badge tone={c.status === "PUBLISHED" ? "green" : c.status === "DRAFT" ? "amber" : "gray"}>{STATUS_LABELS[c.status]}</Badge>
                  </td>
                  <td>{c._count.modules}</td>
                  <td>{c.modules.reduce((s, m) => s + m._count.lessons, 0)}</td>
                  <td>{c._count.enrollments}</td>
                  <td className="text-slate-500">{c.author.name}</td>
                  <td className="text-slate-500">{formatDate(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
