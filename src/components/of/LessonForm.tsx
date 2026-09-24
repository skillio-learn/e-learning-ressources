"use client";
import { useEffect, useState } from "react";
import { Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { LESSON_TYPE_LABELS } from "@/lib/utils";

type LessonType = keyof typeof LESSON_TYPE_LABELS;

export type LessonFormData = {
  title: string;
  summary: string | null;
  type: LessonType;
  durationMin: number | null;
  minTimeSec: number | null;
  required: boolean;
  published: boolean;
  content: string | null;
  embedUrl: string | null;
  hasHtml: boolean;
  completionMode: "MANUAL" | "AUTO" | "ON_VIEW";
  videoUrl: string | null;
  resourceUrl: string | null;
  rubricId: string | null;
  moduleId: string;
};

export function LessonForm({
  action,
  lesson,
  modules,
  rubrics,
  newRubricHref,
}: {
  action: (fd: FormData) => Promise<void>;
  lesson: LessonFormData;
  modules: { id: string; title: string }[];
  rubrics: { id: string; title: string; scope: string }[];
  newRubricHref: string;
}) {
  const [type, setType] = useState<LessonType>(lesson.type);
  const [source, setSource] = useState<"url" | "html">(lesson.hasHtml ? "html" : "url");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <form action={action} className="space-y-6">
      <section className="card space-y-4 p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <Field label="Titre de la leçon *">
            <input name="title" required defaultValue={lesson.title} className="input" />
          </Field>
          <Field label="Type d'étape">
            <select name="type" value={type} onChange={(e) => setType(e.target.value as LessonType)} className="input">
              {(Object.keys(LESSON_TYPE_LABELS) as LessonType[]).map((t) => (
                <option key={t} value={t}>{LESSON_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Résumé (affiché sous le titre)">
          <input name="summary" defaultValue={lesson.summary ?? ""} className="input" />
        </Field>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Durée estimée (min)">
            <input name="durationMin" type="number" min="0" defaultValue={lesson.durationMin ?? ""} className="input" />
          </Field>
          <Field label="Temps minimum (min)" hint="Temps actif requis avant de pouvoir valider l'étape (traçabilité FOAD).">
            <input name="minTimeMin" type="number" min="0" step="0.5" defaultValue={lesson.minTimeSec ? lesson.minTimeSec / 60 : ""} className="input" />
          </Field>
          <Field label="Module">
            <select name="moduleId" defaultValue={lesson.moduleId} className="input">
              {modules.map((m, i) => <option key={m.id} value={m.id}>Module {i + 1} · {m.title}</option>)}
            </select>
          </Field>
          <div className="space-y-2 pt-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="required" defaultChecked={lesson.required} className="accent-brand-600" />
              Étape obligatoire
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="published" defaultChecked={lesson.published} className="accent-brand-600" />
              Visible par les apprenants
            </label>
          </div>
        </div>
      </section>

      {type === "INTERACTIVE" && (
        <section className="card space-y-4 p-6">
          <h2>Module interactif</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSource("url")} className={source === "url" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>URL du module</button>
            <button type="button" onClick={() => setSource("html")} className={source === "html" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>Importer un fichier HTML</button>
          </div>
          {source === "url" ? (
            <Field label="URL du module" hint="Ex : https://ressources-e-learning-skillio3.vercel.app/modules/…/ — le module s'affiche dans la leçon.">
              <input name="embedUrl" type="url" defaultValue={lesson.embedUrl ?? ""} className="input" placeholder="https://…" />
            </Field>
          ) : (
            <div className="space-y-2">
              <input type="hidden" name="embedUrl" value={lesson.embedUrl ?? ""} />
              <Field label="Fichier HTML autonome (.html, 5 Mo max)" hint="Les images/scripts doivent être intégrés au fichier ou référencés par URL absolue.">
                <input name="htmlFile" type="file" accept=".html,.htm,text/html" className="block text-sm" />
              </Field>
              {lesson.hasHtml && (
                <label className="flex items-center gap-2 text-sm text-red-600">
                  <input type="checkbox" name="removeHtml" /> Supprimer le HTML importé actuel
                </label>
              )}
            </div>
          )}
          <Field label="Validation de l'étape">
            <select name="completionMode" defaultValue={lesson.completionMode} className="input">
              <option value="MANUAL">L&apos;apprenant clique sur « Marquer comme terminé »</option>
              <option value="AUTO">Automatique : le module signale la fin (lms-bridge.js)</option>
              <option value="ON_VIEW">Dès l&apos;ouverture de l&apos;étape</option>
            </select>
          </Field>
          <details className="rounded-lg bg-slate-50 p-3 text-sm">
            <summary className="cursor-pointer font-medium">Comment activer la validation automatique dans mes modules ?</summary>
            <div className="mt-2 space-y-2 text-slate-600">
              <p>Ajoutez ce script dans le HTML de votre module :</p>
              <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">{`<script src="${origin}/lms-bridge.js"></script>`}</pre>
              <p>Puis, à la fin du module (ex. bouton « Terminer ») : <code>LMS.complete()</code> ou <code>LMS.complete(score)</code>.</p>
              <p>Ou sans code : <code>&lt;body data-lms-complete-on=&quot;#bouton-fin&quot;&gt;</code>.</p>
            </div>
          </details>
        </section>
      )}

      {type === "VIDEO" && (
        <section className="card space-y-4 p-6">
          <h2>Vidéo</h2>
          <Field label="URL de la vidéo" hint="YouTube, Vimeo ou fichier MP4.">
            <input name="videoUrl" type="url" defaultValue={lesson.videoUrl ?? ""} className="input" />
          </Field>
          <CompletionSelect value={lesson.completionMode} />
        </section>
      )}
      {type !== "VIDEO" && <input type="hidden" name="videoUrl" value={lesson.videoUrl ?? ""} />}

      {type === "RESOURCE" && (
        <section className="card space-y-4 p-6">
          <h2>Ressource</h2>
          <Field label="Lien vers la ressource" hint="PDF, Google Drive, Canva, site…">
            <input name="resourceUrl" type="url" defaultValue={lesson.resourceUrl ?? ""} className="input" />
          </Field>
          <CompletionSelect value={lesson.completionMode} />
        </section>
      )}
      {type !== "RESOURCE" && <input type="hidden" name="resourceUrl" value={lesson.resourceUrl ?? ""} />}
      {type === "CONTENT" && (
        <section className="card p-6">
          <CompletionSelect value={lesson.completionMode} />
        </section>
      )}
      {!["INTERACTIVE", "VIDEO", "RESOURCE", "CONTENT"].includes(type) && <input type="hidden" name="completionMode" value="MANUAL" />}
      {type !== "INTERACTIVE" && <input type="hidden" name="embedUrl" value={lesson.embedUrl ?? ""} />}

      {type === "ASSIGNMENT" && (
        <section className="card space-y-4 p-6">
          <h2>Devoir évalué</h2>
          <Field label="Grille d'évaluation">
            <select name="rubricId" defaultValue={lesson.rubricId ?? ""} className="input">
              <option value="">— Aucune (note libre) —</option>
              {rubrics.map((r) => <option key={r.id} value={r.id}>{r.title} ({r.scope})</option>)}
            </select>
          </Field>
          <a href={newRubricHref} className="text-sm text-brand-600 hover:underline">+ Créer une nouvelle grille pour cette formation</a>
        </section>
      )}
      {type !== "ASSIGNMENT" && <input type="hidden" name="rubricId" value={lesson.rubricId ?? ""} />}

      <section className="card space-y-2 p-6">
        <h2>
          {type === "ASSIGNMENT" ? "Consignes du devoir" : type === "QUIZ" ? "Texte d'introduction (facultatif)" : type === "INTERACTIVE" ? "Texte complémentaire (sous le module)" : "Contenu de la leçon"}
        </h2>
        <p className="text-xs text-slate-500">Format Markdown : # Titre, **gras**, *italique*, - liste, [lien](https://…), ![image](https://…)</p>
        <textarea name="content" rows={type === "CONTENT" ? 18 : 8} defaultValue={lesson.content ?? ""} className="input font-mono text-sm" />
      </section>

      <div className="flex justify-end">
        <SubmitButton>Enregistrer la leçon</SubmitButton>
      </div>
    </form>
  );
}

function CompletionSelect({ value }: { value: string }) {
  return (
    <Field label="Validation de l'étape">
      <select name="completionMode" defaultValue={value === "AUTO" ? "MANUAL" : value} className="input">
        <option value="MANUAL">L&apos;apprenant clique sur « Marquer comme terminé »</option>
        <option value="ON_VIEW">Dès l&apos;ouverture de l&apos;étape</option>
      </select>
    </Field>
  );
}
