import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { renderMarkdown } from "@/lib/markdown";
import { gradeSubmissionAction } from "@/app/actions/of";
import { RubricGrader } from "@/components/rubric/RubricGrader";
import { RubricTable, rubricInclude } from "@/components/rubric/RubricTable";
import { PrintButton } from "@/components/PrintButton";
import { Badge, Container, Field } from "@/components/ui";
import { formatDate, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GradeSubmission({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const user = await requireRole("ADMIN", "OF_ADMIN", "TRAINER");
  const sub = await db.submission.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      gradedBy: { select: { name: true } },
      rubricScores: true,
      lesson: {
        select: {
          title: true,
          content: true,
          rubric: { include: rubricInclude },
          module: { select: { courseId: true, course: { select: { title: true } } } },
        },
      },
    },
  });
  if (!sub || !(await canManageCourse(user, sub.lesson.module.courseId))) notFound();
  const rubric = sub.lesson.rubric;
  const initial = Object.fromEntries(sub.rubricScores.map((s) => [s.criterionId, s]));
  const courseId = sub.lesson.module.courseId;

  return (
    <Container className="max-w-6xl">
      <div className="no-print mb-2 flex items-center justify-between">
        <Link href="/of/grading" className="text-sm text-slate-500 hover:text-brand-600">← Corrections</Link>
        <PrintButton label="Imprimer / PDF de la grille" />
      </div>
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Grille d&apos;évaluation · {sub.lesson.module.course.title}</div>
        <h1>{sub.lesson.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>
            Apprenant : <Link href={`/of/courses/${courseId}/learners/${sub.user.id}`} className="font-medium hover:underline">{sub.user.name}</Link> ({sub.user.email})
          </span>
          <span>· Remis le {formatDate(sub.submittedAt, true)}</span>
          {sub.status === "SUBMITTED" && <Badge tone="amber">À évaluer</Badge>}
          {sub.status === "GRADED" && <Badge tone={sub.passed ? "green" : "red"}>{sub.passed ? "Validé" : "Non validé"} · {pct(sub.percent)}</Badge>}
          {sub.status === "NEEDS_REVISION" && <Badge tone="purple">À reprendre</Badge>}
        </div>
        {sub.gradedAt && <div className="text-xs text-slate-500">Évalué par {sub.gradedBy?.name} le {formatDate(sub.gradedAt, true)}</div>}
      </div>
      {saved && <p className="no-print mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">Évaluation enregistrée.</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-2">Travail rendu</h2>
            {sub.text ? <div className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{sub.text}</div> : <p className="text-sm text-slate-400">Pas de texte.</p>}
            {sub.linkUrl && <p className="mt-3 text-sm"><a href={sub.linkUrl} target="_blank" rel="noopener noreferrer" className="break-all text-brand-600 underline">{sub.linkUrl}</a></p>}
            {sub.fileName && <p className="mt-3 text-sm"><a href={`/api/submissions/${sub.id}/file`} className="text-brand-600 underline">{sub.fileName}</a></p>}
          </div>
          {sub.lesson.content && (
            <details className="card no-print p-5">
              <summary className="cursor-pointer font-semibold">Consignes du devoir</summary>
              <div className="prose-lms mt-2 text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(sub.lesson.content) }} />
            </details>
          )}
        </section>

        <section>
          {/* Version imprimable */}
          {rubric && (
            <div className="hidden print:block">
              <RubricTable rubric={rubric} scores={initial} />
              {sub.feedback && <p className="mt-4 text-sm"><b>Commentaire général :</b> {sub.feedback}</p>}
              <p className="mt-2 text-sm"><b>Note :</b> {sub.score ?? "—"} / {sub.maxScore ?? "—"} ({pct(sub.percent)})</p>
            </div>
          )}
          <form action={gradeSubmissionAction.bind(null, sub.id)} className="card no-print space-y-4 p-5">
            <h2>{rubric ? `Grille : ${rubric.title}` : "Notation"}</h2>
            {rubric ? (
              <RubricGrader rubric={rubric} initial={initial} />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Note"><input name="score" type="number" step="0.25" min="0" defaultValue={sub.score ?? ""} className="input" required /></Field>
                <Field label="Sur"><input name="maxScore" type="number" step="0.25" min="1" defaultValue={sub.maxScore ?? 20} className="input" /></Field>
              </div>
            )}
            <Field label="Commentaire général pour l'apprenant">
              <textarea name="feedback" rows={4} defaultValue={sub.feedback ?? ""} className="input" />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <button name="decision" value="revision" className="btn-secondary">↩ Demander une reprise</button>
              <button name="decision" value="grade" className="btn-primary">✓ Enregistrer l&apos;évaluation</button>
            </div>
          </form>
        </section>
      </div>
    </Container>
  );
}
