import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  deleteLessonAction,
  importQuestionsAction,
  updateLessonAction,
  updateQuizSettingsAction,
} from "@/app/actions/of";
import { LessonForm } from "@/components/of/LessonForm";
import { QuestionEditor } from "@/components/of/QuestionEditor";
import { SubmitButton } from "@/components/SubmitButton";
import { Field } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LessonEditor({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: { select: { courseId: true, title: true, position: true } },
      quiz: { include: { questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } } } },
    },
  });
  if (!lesson || lesson.module.courseId !== id) notFound();

  const [modules, rubrics, course] = await Promise.all([
    db.module.findMany({ where: { courseId: id }, orderBy: { position: "asc" }, select: { id: true, title: true } }),
    db.rubric.findMany({
      where: { OR: [{ courseId: id }, { courseId: null }] },
      orderBy: { title: "asc" },
      select: { id: true, title: true, courseId: true },
    }),
    db.course.findUniqueOrThrow({ where: { id }, select: { slug: true } }),
  ]);
  const quiz = lesson.quiz;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={`/of/courses/${id}`} className="text-sm text-slate-500 hover:text-brand-600">← Parcours</Link>
          <Link href={`/learn/${course.slug}/${lesson.id}`} className="btn-secondary btn-sm">👁 Voir comme l&apos;apprenant</Link>
        </div>

        <LessonForm
          action={updateLessonAction.bind(null, lesson.id)}
          modules={modules}
          rubrics={rubrics.map((r) => ({ id: r.id, title: r.title, scope: r.courseId ? "cette formation" : "partagée" }))}
          newRubricHref={`/of/rubrics/new?courseId=${id}&lessonId=${lesson.id}`}
          lesson={{
            title: lesson.title,
            summary: lesson.summary,
            type: lesson.type,
            durationMin: lesson.durationMin,
            minTimeSec: lesson.minTimeSec,
            required: lesson.required,
            published: lesson.published,
            content: lesson.content,
            embedUrl: lesson.embedUrl,
            hasHtml: !!lesson.htmlContent,
            completionMode: lesson.completionMode,
            videoUrl: lesson.videoUrl,
            resourceUrl: lesson.resourceUrl,
            rubricId: lesson.rubricId,
            moduleId: lesson.moduleId,
          }}
        />

        {lesson.type === "QUIZ" && quiz && (
          <>
            <section className="card p-6">
              <h2 className="mb-4">⚙️ Paramètres du quiz</h2>
              <form action={updateQuizSettingsAction.bind(null, quiz.id)} className="space-y-4">
                <Field label="Consignes affichées avant de commencer">
                  <textarea name="instructions" rows={3} defaultValue={quiz.instructions ?? ""} className="input" />
                </Field>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Score de réussite (%)">
                    <input name="passingScore" type="number" min="0" max="100" defaultValue={quiz.passingScore} className="input" />
                  </Field>
                  <Field label="Tentatives max" hint="Vide = illimité">
                    <input name="maxAttempts" type="number" min="1" defaultValue={quiz.maxAttempts ?? ""} className="input" />
                  </Field>
                  <Field label="Durée limite (min)" hint="Vide = sans limite">
                    <input name="timeLimitMin" type="number" min="1" defaultValue={quiz.timeLimitMin ?? ""} className="input" />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-6 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" name="graded" defaultChecked={quiz.graded} className="accent-brand-600" /> Quiz noté (compte pour la validation)</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="showCorrection" defaultChecked={quiz.showCorrection} className="accent-brand-600" /> Afficher la correction</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="shuffleQuestions" defaultChecked={quiz.shuffleQuestions} className="accent-brand-600" /> Mélanger les questions</label>
                </div>
                <SubmitButton>Enregistrer les paramètres</SubmitButton>
              </form>
            </section>

            <section className="space-y-3">
              <h2>❓ Questions ({quiz.questions.length} · {quiz.questions.reduce((s, q) => s + q.points, 0)} pt)</h2>
              <QuestionEditor
                quizId={quiz.id}
                questions={quiz.questions.map((q) => ({
                  id: q.id,
                  type: q.type,
                  text: q.text,
                  explanation: q.explanation,
                  points: q.points,
                  acceptedAnswers: q.acceptedAnswers,
                  options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
                }))}
              />
            </section>

            <details className="card p-6">
              <summary className="cursor-pointer font-semibold">⚡ Importer des questions en texte</summary>
              <form action={importQuestionsAction.bind(null, quiz.id)} className="mt-4 space-y-3">
                <pre className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{`? Quel format est le plus adapté à TikTok ?
- 16:9 horizontal
+ 9:16 vertical
- 1:1 carré
> Le format vertical occupe tout l'écran du smartphone.

? Quels éléments améliorent la rétention ? (plusieurs réponses)
+ Une accroche dans les 3 premières secondes
+ Des sous-titres
- Une longue introduction

?VF Les sous-titres sont inutiles sur Instagram.
+ Faux

? Citez le nom de l'algorithme de recommandation de TikTok.
= For You
= FYP

? Expliquez votre stratégie de publication pour une marque locale.`}</pre>
                <textarea name="text" rows={10} className="input font-mono text-xs" placeholder="Collez vos questions ici (blocs séparés par une ligne vide)" />
                <SubmitButton className="btn-secondary">Importer</SubmitButton>
              </form>
            </details>
          </>
        )}
      </div>

      <aside className="space-y-4">
        <div className="card space-y-2 p-4 text-sm">
          <div className="text-xs font-semibold uppercase text-slate-400">Emplacement</div>
          <div>Module {lesson.module.position + 1} · {lesson.module.title}</div>
          <div>Étape n° {lesson.position + 1} du module</div>
        </div>
        <form action={deleteLessonAction.bind(null, lesson.id)} className="card p-4">
          <SubmitButton className="btn-danger w-full" confirm="Supprimer définitivement cette leçon et les résultats associés ?">
            Supprimer la leçon
          </SubmitButton>
        </form>
      </aside>
    </div>
  );
}
