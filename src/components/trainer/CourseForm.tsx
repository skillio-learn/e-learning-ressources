import type { Course } from "@prisma/client";
import { Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function CourseForm({
  action,
  course,
  isNew,
}: {
  action: (fd: FormData) => Promise<void>;
  course?: Partial<Course>;
  isNew?: boolean;
}) {
  return (
    <form action={action} className="space-y-6">
      <section className="card space-y-4 p-6">
        <h2>Informations générales</h2>
        <Field label="Titre de la formation *">
          <input name="title" required defaultValue={course?.title} className="input" placeholder="Ex : Production de contenus audiovisuels sur les réseaux sociaux" />
        </Field>
        <Field label="Sous-titre / accroche">
          <input name="subtitle" defaultValue={course?.subtitle ?? ""} className="input" />
        </Field>
        {!isNew && (
          <Field label="Identifiant d'URL (slug)" hint="Laissé vide, il est généré depuis le titre.">
            <input name="slug" defaultValue={course?.slug ?? ""} className="input" />
          </Field>
        )}
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Catégorie">
            <input name="category" defaultValue={course?.category ?? ""} className="input" placeholder="Marketing digital" />
          </Field>
          <Field label="Niveau">
            <select name="level" defaultValue={course?.level ?? "BEGINNER"} className="input">
              <option value="BEGINNER">Débutant</option>
              <option value="INTERMEDIATE">Intermédiaire</option>
              <option value="ADVANCED">Avancé</option>
            </select>
          </Field>
          <Field label="Durée (heures)">
            <input name="durationHours" type="number" step="0.5" min="0" defaultValue={course?.durationHours ?? ""} className="input" />
          </Field>
          {isNew && (
            <Field label="Nombre de modules à créer" hint="Vous pourrez en ajouter ensuite.">
              <input name="moduleCount" type="number" min="0" max="30" defaultValue={1} className="input" />
            </Field>
          )}
        </div>
        <Field label="Image de couverture (URL)">
          <input name="coverUrl" type="url" defaultValue={course?.coverUrl ?? ""} className="input" placeholder="https://…" />
        </Field>
      </section>

      <section className="card space-y-4 p-6">
        <h2>Contenu pédagogique</h2>
        <p className="text-xs text-slate-500">Tous les champs texte acceptent le format Markdown (titres, listes, gras, liens…).</p>
        <Field label="Présentation">
          <textarea name="description" rows={5} defaultValue={course?.description ?? ""} className="input" />
        </Field>
        <Field label="Objectifs pédagogiques" hint="Un objectif par ligne, en commençant par « - ».">
          <textarea name="objectives" rows={5} defaultValue={course?.objectives ?? ""} className="input" placeholder={"- Concevoir une ligne éditoriale\n- Tourner une vidéo verticale\n- …"} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Prérequis">
            <textarea name="prerequisites" rows={3} defaultValue={course?.prerequisites ?? ""} className="input" />
          </Field>
          <Field label="Public visé">
            <textarea name="audience" rows={3} defaultValue={course?.audience ?? ""} className="input" />
          </Field>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2>Parcours & validation</h2>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="sequential" defaultChecked={course?.sequential ?? true} className="mt-1 accent-brand-600" />
          <span>
            <span className="font-medium">Parcours étape par étape</span>
            <span className="block text-sm text-slate-500">Chaque leçon obligatoire doit être terminée pour débloquer la suivante.</span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="certificateEnabled" defaultChecked={course?.certificateEnabled ?? true} className="mt-1 accent-brand-600" />
          <span>
            <span className="font-medium">Délivrer un certificat</span>
            <span className="block text-sm text-slate-500">Automatiquement à la validation de la formation.</span>
          </span>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Moyenne minimale pour valider (%)" hint="Moyenne des quiz notés et devoirs évalués.">
            <input name="passingScore" type="number" min="0" max="100" defaultValue={course?.passingScore ?? 70} className="input" />
          </Field>
          <Field label="Inscription">
            <select name="enrollmentPolicy" defaultValue={course?.enrollmentPolicy ?? "INVITE"} className="input">
              <option value="INVITE">Sur invitation (le formateur inscrit les apprenants)</option>
              <option value="OPEN">Libre (depuis le catalogue)</option>
            </select>
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton>{isNew ? "Créer la formation" : "Enregistrer"}</SubmitButton>
      </div>
    </form>
  );
}
