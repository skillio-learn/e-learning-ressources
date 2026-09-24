import { db } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate, pct } from "@/lib/utils";
import { submitAssignmentAction } from "@/app/actions/learner";
import { SubmitButton } from "@/components/SubmitButton";
import { RubricTable, rubricInclude } from "@/components/rubric/RubricTable";
import { Badge } from "@/components/ui";

export async function AssignmentPanel({
  lessonId,
  userId,
  preview,
  content,
}: {
  lessonId: string;
  userId: string;
  preview: boolean;
  content: string | null;
}) {
  const [lesson, submission] = await Promise.all([
    db.lesson.findUnique({ where: { id: lessonId }, select: { rubric: { include: rubricInclude } } }),
    db.submission.findFirst({
      where: { lessonId, userId },
      orderBy: { submittedAt: "desc" },
      include: { rubricScores: true, gradedBy: { select: { name: true } } },
    }),
  ]);
  const rubric = lesson?.rubric;
  const scores = submission?.status === "GRADED" || submission?.status === "NEEDS_REVISION"
    ? Object.fromEntries(submission.rubricScores.map((s) => [s.criterionId, s]))
    : undefined;
  const canSubmit = !preview && submission?.status !== "GRADED";

  return (
    <div className="space-y-6">
      {content && (
        <section className="card p-6">
          <h2 className="mb-2">Consignes</h2>
          <div className="prose-lms" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
        </section>
      )}

      {rubric && (
        <section className="card p-6">
          <h2 className="mb-1">Grille d&apos;évaluation : {rubric.title}</h2>
          {rubric.description && <p className="mb-3 text-sm text-slate-500">{rubric.description}</p>}
          <RubricTable rubric={rubric} scores={scores} />
        </section>
      )}

      {submission && (
        <section className="card p-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2>Mon rendu</h2>
            {submission.status === "SUBMITTED" && <Badge tone="amber">En attente d&apos;évaluation</Badge>}
            {submission.status === "GRADED" && <Badge tone={submission.passed ? "green" : "red"}>{submission.passed ? "Validé" : "Non validé"}</Badge>}
            {submission.status === "NEEDS_REVISION" && <Badge tone="purple">À reprendre</Badge>}
            <span className="text-xs text-slate-500">Remis le {formatDate(submission.submittedAt, true)}</span>
          </div>
          {submission.text && <div className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{submission.text}</div>}
          {submission.linkUrl && (
            <p className="mt-2 text-sm"><a href={submission.linkUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">{submission.linkUrl}</a></p>
          )}
          {submission.fileName && (
            <p className="mt-2 text-sm"><a href={`/api/submissions/${submission.id}/file`} className="text-brand-600 underline">{submission.fileName}</a></p>
          )}
          {(submission.status === "GRADED" || submission.status === "NEEDS_REVISION") && (
            <div className="mt-4 rounded-lg bg-brand-50 p-4">
              <div className="text-sm text-slate-600">Note</div>
              <div className="text-3xl font-extrabold">{pct(submission.percent)}</div>
              <div className="text-sm text-slate-600">{submission.score} / {submission.maxScore} pt — évalué par {submission.gradedBy?.name ?? "le formateur"} le {formatDate(submission.gradedAt)}</div>
              {submission.feedback && <p className="mt-3 whitespace-pre-wrap text-sm"><b>Commentaire :</b> {submission.feedback}</p>}
            </div>
          )}
        </section>
      )}

      {canSubmit ? (
        <section className="card p-6">
          <h2 className="mb-3">{submission ? "Mettre à jour mon rendu" : "Remettre mon travail"}</h2>
          <form action={submitAssignmentAction.bind(null, lessonId)} className="space-y-4">
            <label className="block">
              <span className="label">Réponse écrite</span>
              <textarea name="text" rows={8} className="input" defaultValue={submission?.text ?? ""} placeholder="Rédigez votre réponse…" />
            </label>
            <label className="block">
              <span className="label">Lien (vidéo, document en ligne, portfolio…)</span>
              <input name="linkUrl" type="url" className="input" defaultValue={submission?.linkUrl ?? ""} placeholder="https://…" />
            </label>
            <label className="block">
              <span className="label">Fichier (8 Mo max)</span>
              <input name="file" type="file" className="block text-sm" />
            </label>
            <SubmitButton pendingLabel="Envoi…">{submission ? "Mettre à jour" : "Remettre le devoir"}</SubmitButton>
          </form>
        </section>
      ) : preview ? (
        <p className="text-sm text-amber-700">Mode aperçu : le formulaire de remise est visible par les apprenants.</p>
      ) : null}
    </div>
  );
}
