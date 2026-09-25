import { requireCourseManager } from "@/lib/permissions";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  addLessonAction,
  addModuleAction,
  bulkAddLessonsAction,
  deleteModuleAction,
  duplicateLessonAction,
  moveLessonAction,
  moveModuleAction,
  updateModuleAction,
} from "@/app/actions/of";
import { SubmitButton } from "@/components/SubmitButton";
import { StateForm } from "@/components/StateForm";
import { addResourceAction, deleteResourceAction } from "@/app/actions/resources";
import { Badge, Empty } from "@/components/ui";
import { LESSON_TYPE_LABELS } from "@/lib/utils";
import { LessonTypeIcon } from "@/components/LessonTypeIcon";

export const dynamic = "force-dynamic";

const TYPES = Object.entries(LESSON_TYPE_LABELS) as [keyof typeof LESSON_TYPE_LABELS, string][];

export default async function CourseStructure({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCourseManager(id);
  const modules = await db.module.findMany({
    where: { courseId: id },
    orderBy: { position: "asc" },
    include: {
      lessons: {
        orderBy: { position: "asc" },
        select: {
          id: true, title: true, type: true, required: true, published: true, durationMin: true, embedUrl: true, htmlContent: true,
          quiz: { select: { _count: { select: { questions: true } } } },
          rubricId: true,
        },
      },
      resources: { orderBy: { position: "asc" }, select: { id: true, title: true, url: true, fileName: true, size: true } },
    },
  });
  const total = modules.reduce((s, m) => s + m.lessons.length, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {modules.length} module(s) · {total} leçon(s). Les apprenants suivent les étapes dans cet ordre.
          </p>
        </div>

        {modules.length === 0 && <Empty title="Aucun module">Ajoutez un premier module avec le formulaire ci-contre.</Empty>}

        {modules.map((m, mi) => (
          <section key={m.id} className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-600 text-xs font-bold text-white">{mi + 1}</span>
              <details className="group flex-1">
                <summary className="cursor-pointer list-none">
                  <span className="font-semibold">Module {mi + 1} · {m.title}</span>
                  <span className="ml-2 text-xs text-slate-400 group-open:hidden">modifier</span>
                </summary>
                <form action={updateModuleAction.bind(null, m.id)} className="mt-3 space-y-2">
                  <input name="title" defaultValue={m.title} className="input" />
                  <textarea name="description" defaultValue={m.description ?? ""} rows={2} className="input" placeholder="Description (facultative)" />
                  <SubmitButton className="btn-primary btn-sm">Enregistrer</SubmitButton>
                </form>
              </details>
              <div className="flex items-center gap-1">
                <form action={moveModuleAction.bind(null, m.id, -1)}><button className="btn-ghost btn-sm" disabled={mi === 0} title="Monter">↑</button></form>
                <form action={moveModuleAction.bind(null, m.id, 1)}><button className="btn-ghost btn-sm" disabled={mi === modules.length - 1} title="Descendre">↓</button></form>
                <form action={deleteModuleAction.bind(null, m.id)}>
                  <SubmitButton className="btn-ghost btn-sm text-red-600" pendingLabel="…" confirm={`Supprimer le module « ${m.title} » et ses ${m.lessons.length} leçon(s) ?`}></SubmitButton>
                </form>
              </div>
            </div>

            <ol className="divide-y divide-slate-100">
              {m.lessons.map((l, li) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                  <span className="w-10 text-xs font-medium text-slate-400">{mi + 1}.{li + 1}</span>
                  <LessonTypeIcon type={l.type} />
                  <Link href={`/of/courses/${id}/lessons/${l.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand-700">
                    {l.title}
                  </Link>
                  <div className="flex flex-wrap gap-1">
                    {!l.published && <Badge tone="amber">Masquée</Badge>}
                    {!l.required && <Badge>Facultative</Badge>}
                    {l.type === "QUIZ" && <Badge tone={l.quiz?._count.questions ? "blue" : "red"}>{l.quiz?._count.questions ?? 0} question(s)</Badge>}
                    {l.type === "INTERACTIVE" && !l.embedUrl && !l.htmlContent && <Badge tone="red">Module non configuré</Badge>}
                    {l.type === "ASSIGNMENT" && !l.rubricId && <Badge tone="amber">Sans grille</Badge>}
                    {l.durationMin ? <Badge>{l.durationMin} min</Badge> : null}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <form action={moveLessonAction.bind(null, l.id, -1)}><button className="btn-ghost btn-sm" disabled={li === 0} title="Monter">↑</button></form>
                    <form action={moveLessonAction.bind(null, l.id, 1)}><button className="btn-ghost btn-sm" disabled={li === m.lessons.length - 1} title="Descendre">↓</button></form>
                    <form action={duplicateLessonAction.bind(null, l.id)}><button className="btn-ghost btn-sm" title="Dupliquer">⧉</button></form>
                    <Link href={`/of/courses/${id}/lessons/${l.id}`} className="btn-ghost btn-sm">Éditer</Link>
                  </div>
                </li>
              ))}
            </ol>

            <details className="border-t border-slate-100 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                Ressources du module ({m.resources.length}) <span className="font-normal text-slate-400">· téléchargeables par l&apos;apprenant dès qu&apos;il commence le module</span>
              </summary>
              <ul className="mt-3 space-y-1.5 text-sm">
                {m.resources.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <a href={`/api/resources/${r.id}`} target="_blank" className="min-w-0 flex-1 truncate hover:text-brand-700">{r.title}</a>
                    <span className="text-xs text-slate-400">{r.url ? "lien" : r.fileName}</span>
                    <form action={deleteResourceAction.bind(null, r.id)}>
                      <SubmitButton className="btn-ghost btn-sm text-red-600" pendingLabel="…" confirm={`Supprimer la ressource « ${r.title} » ?`}>Supprimer</SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
              <StateForm action={addResourceAction.bind(null, m.id)} submitLabel="Ajouter la ressource" submitClassName="btn-secondary btn-sm" className="mt-3 grid gap-2 md:grid-cols-2">
                <input name="title" required placeholder="Titre (ex. Énoncé de l'exercice 2)" className="input" />
                <input name="description" placeholder="Description (facultative)" className="input" />
                <label className="text-xs text-slate-500">Fichier (PDF, Word, Excel, PowerPoint, image, ZIP, MP3/MP4 · 4 Mo max.)
                  <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.odt,.xlsx,.pptx,.zip,.mp3,.mp4" className="input mt-1" />
                </label>
                <label className="text-xs text-slate-500">ou lien externe (https)
                  <input name="url" type="url" placeholder="https://…" className="input mt-1" />
                </label>
              </StateForm>
            </details>

            <div className="grid gap-3 border-t border-slate-100 bg-slate-50/50 p-4 md:grid-cols-2">
              <form action={addLessonAction.bind(null, m.id)} className="flex flex-wrap gap-2">
                <input name="title" placeholder="Titre de la nouvelle leçon" className="input min-w-0 flex-1" required />
                <select name="type" className="input w-auto">
                  {TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
                <SubmitButton className="btn-primary" pendingLabel="…">+ Leçon</SubmitButton>
              </form>
              <details>
                <summary className="cursor-pointer text-sm font-medium text-brand-700">Ajouter plusieurs leçons d&apos;un coup</summary>
                <form action={bulkAddLessonsAction.bind(null, m.id)} className="mt-2 space-y-2">
                  <textarea
                    name="lines"
                    rows={6}
                    className="input font-mono text-xs"
                    placeholder={"Une leçon par ligne. Facultatif : « | URL » pour un module interactif.\nBienvenue | https://mon-site.vercel.app/modules/module-1-bienvenue/\nLes formats vidéo\nQuiz de fin de module"}
                  />
                  <div className="flex gap-2">
                    <select name="type" className="input w-auto" defaultValue="INTERACTIVE">
                      {TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                    <SubmitButton className="btn-secondary">Créer les leçons</SubmitButton>
                  </div>
                </form>
              </details>
            </div>
          </section>
        ))}
      </div>

      <aside className="space-y-4">
        <form action={addModuleAction.bind(null, id)} className="card space-y-3 p-4">
          <h2 className="text-base">Ajouter un module</h2>
          <input name="title" placeholder={`Module ${modules.length + 1} : titre`} className="input" />
          <textarea name="description" rows={2} placeholder="Description (facultative)" className="input" />
          <SubmitButton className="btn-primary w-full">+ Ajouter le module</SubmitButton>
        </form>
        <div className="card space-y-2 p-4 text-sm text-slate-600">
          <h2 className="text-base">Types d&apos;étapes</h2>
          <p><b>Module interactif</b> : intégrez l&apos;URL de vos modules HTML (Vercel…) ou importez un fichier HTML.</p>
          <p><b>Quiz</b> : QCM, vrai/faux, réponse courte, question ouverte. Correction automatique + manuelle.</p>
          <p><b>Devoir évalué</b> : l&apos;apprenant remet un travail, vous l&apos;évaluez avec une grille critériée.</p>
          <p><b>Contenu / Vidéo / Ressource</b> : cours texte, vidéos YouTube/Vimeo, documents.</p>
        </div>
      </aside>
    </div>
  );
}
