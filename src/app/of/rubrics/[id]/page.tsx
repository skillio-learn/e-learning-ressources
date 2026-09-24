import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { canManageRubric, manageableCoursesWhere } from "@/lib/permissions";
import { deleteRubricAction, duplicateRubricAction } from "@/app/actions/of";
import { RubricEditor } from "@/components/rubric/RubricEditor";
import { RubricTable, rubricInclude } from "@/components/rubric/RubricTable";
import { SubmitButton } from "@/components/SubmitButton";
import { PrintButton } from "@/components/PrintButton";
import { Badge, Container, PageHeader } from "@/components/ui";
import { formatDate, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RubricPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("ADMIN", "OF_ADMIN", "TRAINER");
  const rubric = await db.rubric.findUnique({ where: { id }, include: { ...rubricInclude, course: { select: { title: true } } } });
  if (!rubric) notFound();
  const editable = await canManageRubric(user, id);
  const manageable = await db.course.findMany({ where: manageableCoursesWhere(user), select: { id: true, title: true }, orderBy: { title: "asc" } });
  const manageableIds = manageable.map((c) => c.id);
  const [used, submissions, lessons] = await Promise.all([
    db.rubricScore.count({ where: { criterion: { rubricId: id } } }),
    db.submission.findMany({
      where: { lesson: { rubricId: id, module: { courseId: { in: manageableIds } } } },
      orderBy: { submittedAt: "desc" },
      include: { user: { select: { name: true } }, lesson: { select: { title: true, module: { select: { course: { select: { title: true } } } } } } },
    }),
    db.lesson.findMany({
      where: { rubricId: id },
      select: { id: true, title: true, module: { select: { courseId: true, course: { select: { title: true } } } } },
    }),
  ]);

  return (
    <Container className="max-w-6xl">
      <PageHeader
        back={{ href: "/of/rubrics", label: "Grilles" }}
        title={rubric.title}
        subtitle={rubric.course ? `Formation : ${rubric.course.title}` : "Grille partagée"}
        actions={
          <>
            <PrintButton label="Imprimer la grille vierge" />
            <form action={duplicateRubricAction.bind(null, id)}><SubmitButton className="btn-secondary">⧉ Dupliquer</SubmitButton></form>
            {editable && (
              <form action={deleteRubricAction.bind(null, id)}>
                <SubmitButton className="btn-danger" confirm="Supprimer cette grille ? Les notes déjà attribuées sont conservées, le détail par critère sera perdu.">
                  Supprimer
                </SubmitButton>
              </form>
            )}
          </>
        }
      />

      <div className="hidden print:block">
        <RubricTable rubric={rubric} />
        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div>Apprenant : ______________________</div>
          <div>Date : ____________ Évaluateur : ____________</div>
        </div>
      </div>

      <div className="no-print space-y-8">
        {editable ? (
          <RubricEditor
            rubricId={id}
            courses={manageable}
            locked={used > 0}
            initial={{
              title: rubric.title,
              description: rubric.description,
              courseId: rubric.courseId,
              passingScore: rubric.passingScore,
              criteria: rubric.criteria.map((c) => ({
                title: c.title,
                description: c.description,
                weight: c.weight,
                levels: c.levels.map((l) => ({ label: l.label, description: l.description, points: l.points })),
              })),
            }}
          />
        ) : (
          <div className="card p-5"><RubricTable rubric={rubric} /></div>
        )}

        <section>
          <h2 className="mb-2">Utilisée dans</h2>
          {lessons.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune leçon. Associez cette grille depuis l&apos;éditeur d&apos;une leçon « Devoir évalué ».</p>
          ) : (
            <ul className="list-disc pl-6 text-sm">
              {lessons.map((l) => (
                <li key={l.id}>
                  {manageableIds.includes(l.module.courseId) ? (
                    <Link href={`/of/courses/${l.module.courseId}/lessons/${l.id}`} className="text-brand-600 hover:underline">{l.title}</Link>
                  ) : l.title}{" "}
                  <span className="text-slate-400">— {l.module.course.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2">Grilles remplies ({submissions.length})</h2>
          {submissions.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="table">
                <thead><tr><th>Apprenant</th><th>Devoir</th><th>Formation</th><th>Remis le</th><th>Note</th><th>Statut</th><th></th></tr></thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.user.name}</td>
                      <td>{s.lesson.title}</td>
                      <td className="text-slate-500">{s.lesson.module.course.title}</td>
                      <td className="text-xs">{formatDate(s.submittedAt, true)}</td>
                      <td className="font-semibold">{pct(s.percent)}</td>
                      <td>{s.status === "SUBMITTED" ? <Badge tone="amber">À évaluer</Badge> : s.status === "GRADED" ? <Badge tone={s.passed ? "green" : "red"}>{s.passed ? "Validé" : "Non validé"}</Badge> : <Badge tone="purple">À reprendre</Badge>}</td>
                      <td className="text-right"><Link href={`/of/grading/submissions/${s.id}`} className="btn-ghost btn-sm">Ouvrir</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Container>
  );
}
