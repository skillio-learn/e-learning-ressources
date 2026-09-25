import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { gradeAttemptAction } from "@/app/actions/of";
import { AttemptReview } from "@/components/quiz/AttemptReview";
import { SubmitButton } from "@/components/SubmitButton";
import { Container, PageHeader, Stat } from "@/components/ui";
import { formatDate, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GradeAttempt({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const user = await requireRole("ADMIN", "OF_ADMIN", "TRAINER");
  const attempt = await db.quizAttempt.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      answers: true,
      quiz: {
        include: {
          lesson: { select: { title: true, module: { select: { courseId: true, course: { select: { title: true } } } } } },
          questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } },
        },
      },
    },
  });
  if (!attempt || !(await canManageCourse(user, attempt.quiz.lesson.module.courseId))) notFound();
  const courseId = attempt.quiz.lesson.module.courseId;

  return (
    <Container className="max-w-4xl">
      <PageHeader
        back={{ href: "/of/grading", label: "Corrections" }}
        title={`Quiz : ${attempt.quiz.lesson.title}`}
        subtitle={
          <>
            <Link href={`/of/courses/${courseId}/learners/${attempt.user.id}`} className="hover:underline">{attempt.user.name}</Link> · {attempt.quiz.lesson.module.course.title} · remis le {formatDate(attempt.submittedAt, true)}
          </>
        }
        actions={<a href={`/api/pdf/attempts/${attempt.id}`} className="btn-secondary">Résultats (PDF)</a>}
      />
      {saved && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">Correction enregistrée.</p>}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Score" value={pct(attempt.percent)} hint={`${attempt.score} / ${attempt.maxScore} pt`} />
        <Stat label="Seuil" value={`${attempt.quiz.passingScore} %`} />
        <Stat label="Statut" value={attempt.status === "PENDING_REVIEW" ? "À corriger" : attempt.passed ? "Réussi" : "Non validé"} />
      </div>
      <form action={gradeAttemptAction.bind(null, attempt.id)} className="space-y-4">
        <AttemptReview
          questions={attempt.quiz.questions}
          answers={attempt.answers}
          showCorrection
          renderExtra={(q, a) =>
            a ? (
              <div className="no-print mt-3 grid gap-2 rounded-lg border border-dashed border-slate-300 p-3 md:grid-cols-[140px_1fr]">
                <label className="block text-xs">
                  <span className="font-medium text-slate-600">Points (/{q.points})</span>
                  <input
                    name={`points_${a.id}`}
                    type="number"
                    step="0.25"
                    min="0"
                    max={q.points}
                    defaultValue={a.needsReview ? "" : a.pointsAwarded}
                    required={a.needsReview}
                    className="input mt-1"
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-medium text-slate-600">Commentaire pour l&apos;apprenant</span>
                  <input name={`feedback_${a.id}`} defaultValue={a.feedback ?? ""} className="input mt-1" />
                </label>
              </div>
            ) : null
          }
        />
        <label className="block">
          <span className="label">Commentaire général</span>
          <textarea name="feedback" rows={3} defaultValue={attempt.feedback ?? ""} className="input" />
        </label>
        <div className="flex justify-end gap-2">
          <SubmitButton>Enregistrer la correction</SubmitButton>
        </div>
      </form>
    </Container>
  );
}
