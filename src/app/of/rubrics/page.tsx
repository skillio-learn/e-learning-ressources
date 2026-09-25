import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { manageableCoursesWhere } from "@/lib/permissions";
import { Badge, Container, Empty, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Grilles d'évaluation" };
export const dynamic = "force-dynamic";

export default async function Rubrics() {
  const user = await requireRole("ADMIN", "OF_ADMIN", "TRAINER");
  const rubrics = await db.rubric.findMany({
    where:
      user.role === "ADMIN"
        ? {}
        : { OR: [{ authorId: user.id }, { courseId: null, author: { organizationId: user.organizationId ?? "__none__" } }, { course: manageableCoursesWhere(user) }] },
    orderBy: { updatedAt: "desc" },
    include: {
      course: { select: { title: true } },
      author: { select: { name: true } },
      _count: { select: { criteria: true, lessons: true } },
      lessons: { select: { _count: { select: { submissions: true } } } },
    },
  });
  return (
    <Container>
      <PageHeader
        title="Grilles d'évaluation"
        subtitle="Grilles critériées pour évaluer les devoirs et mises en situation. Récupérez les grilles remplies en CSV ou en PDF."
        actions={<Link href="/of/rubrics/new" className="btn-primary">+ Nouvelle grille</Link>}
      />
      {rubrics.length === 0 ? (
        <Empty title="Aucune grille">Créez une grille puis associez-la à une leçon de type « Devoir évalué ».</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rubrics.map((r) => (
            <Link key={r.id} href={`/of/rubrics/${r.id}`} className="card flex flex-col gap-2 p-5 hover:shadow-md">
              <div className="font-semibold">{r.title}</div>
              {r.description && <p className="line-clamp-2 text-sm text-slate-500">{r.description}</p>}
              <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                <Badge tone="blue">{r._count.criteria} critère(s)</Badge>
                <Badge>{r._count.lessons} devoir(s)</Badge>
                <Badge tone="purple">{r.lessons.reduce((s, l) => s + l._count.submissions, 0)} copie(s)</Badge>
                <Badge>{r.course ? r.course.title : "Partagée"}</Badge>
              </div>
              <div className="text-xs text-slate-400">par {r.author.name} · {formatDate(r.updatedAt)}</div>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
