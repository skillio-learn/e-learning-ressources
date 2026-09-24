import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { manageableCoursesWhere } from "@/lib/permissions";
import { Badge, Container, Empty, PageHeader } from "@/components/ui";
import { formatHours } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Apprenants" };
export const dynamic = "force-dynamic";

export default async function OfLearners({ searchParams }: { searchParams: Promise<{ q?: string; course?: string }> }) {
  const user = await requireStaff();
  const { q, course } = await searchParams;
  const courses = await db.course.findMany({ where: manageableCoursesWhere(user), select: { id: true, title: true }, orderBy: { title: "asc" } });
  const ids = course && courses.some((c) => c.id === course) ? [course] : courses.map((c) => c.id);
  const where: Prisma.UserWhereInput = {
    role: "LEARNER",
    OR: [
      { enrollments: { some: { courseId: { in: ids } } } },
      ...(user.role !== "TRAINER" ? [{ applications: { some: { courseId: { in: ids }, status: { not: "DRAFT" as const } } } }] : []),
    ],
    ...(q ? { AND: [{ OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }] } : {}),
  };
  const learners = await db.user.findMany({
    where,
    orderBy: { name: "asc" },
    take: 500,
    select: {
      id: true, name: true, email: true, lastLoginAt: true, active: true, deletionRequestedAt: true,
      enrollments: { where: { courseId: { in: ids } }, select: { status: true, course: { select: { title: true } } } },
      applications: { where: { courseId: { in: ids }, status: { in: ["SUBMITTED", "UNDER_REVIEW", "INCOMPLETE", "ACCEPTED"] } }, select: { id: true } },
    },
  });
  const times = await db.timeLog.groupBy({ by: ["userId"], where: { userId: { in: learners.map((l) => l.id) }, courseId: { in: ids } }, _sum: { seconds: true } });
  const timeMap = new Map(times.map((t) => [t.userId, t._sum.seconds ?? 0]));
  return (
    <Container>
      <PageHeader title="Apprenants" subtitle={`${learners.length} apprenant(s)`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Nom ou email" className="input max-w-xs" />
        <select name="course" defaultValue={course ?? ""} className="input max-w-xs">
          <option value="">Toutes les formations</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>
      {learners.length === 0 ? (
        <Empty title="Aucun apprenant" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Apprenant</th><th>Formations</th><th>Temps de formation</th><th>Dernière connexion</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {learners.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td>
                    <Link href={`/of/learners/${l.id}`} className="font-medium hover:text-brand-700">{l.name}</Link>
                    <div className="text-xs text-slate-500">{l.email}</div>
                  </td>
                  <td className="text-xs">
                    {l.enrollments.map((e) => e.course.title).join(", ") || "—"}
                    {l.applications.length > 0 && <div className="text-amber-700">{l.applications.length} dossier(s) en cours</div>}
                  </td>
                  <td>{formatHours(timeMap.get(l.id))}</td>
                  <td className="text-xs">{formatDate(l.lastLoginAt, true)}</td>
                  <td className="space-x-1">
                    {!l.active && <Badge tone="red">Désactivé</Badge>}
                    {l.deletionRequestedAt && <Badge tone="amber">Suppression demandée</Badge>}
                    {l.enrollments.some((e) => e.status === "COMPLETED") && <Badge tone="green">Formation terminée</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
