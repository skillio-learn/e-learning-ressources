import type { Course } from "@prisma/client";
import { DOCUMENT_TYPES } from "@/lib/labels";
import { Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function CourseForm({
  action,
  course,
  isNew,
  organizations,
  team,
}: {
  action: (fd: FormData) => Promise<void>;
  course?: Partial<Course>;
  isNew?: boolean;
  organizations?: { id: string; name: string }[];
  team?: { id: string; name: string }[];
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
        {organizations && organizations.length > 0 && (
          <Field label="Organisme de formation">
            <select name="organizationId" defaultValue={course?.organizationId ?? organizations[0].id} className="input">
              {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        )}
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
                <Field label="Compétences visées (une par ligne)" hint="Servent au positionnement d'entrée du candidat et à son auto-évaluation de fin de formation (Qualiopi, indicateur 8).">
          <textarea name="skills" rows={4} defaultValue={course?.skills?.join("\n") ?? ""} className="input" placeholder={"Concevoir une ligne éditoriale\nTourner une vidéo verticale\nMonter et sous-titrer une vidéo"} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Méthodes et moyens pédagogiques"><textarea name="pedagogicalMethods" rows={3} defaultValue={course?.pedagogicalMethods ?? ""} className="input" /></Field>
          <Field label="Modalités d'évaluation"><textarea name="evaluationMethods" rows={3} defaultValue={course?.evaluationMethods ?? ""} className="input" /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Délai d'accès" hint="Qualiopi, indicateur 1 : délai entre la demande et le début de la formation.">
            <input name="accessDelay" defaultValue={course?.accessDelay ?? ""} className="input" placeholder="Ex. 14 jours après signature de la convention" />
          </Field>
          {team && (
            <Field label="Référent pédagogique" hint="Qualiopi 2026, indicateur 19 : interlocuteur pédagogique de la formation.">
              <select name="pedagogicalReferentId" defaultValue={course?.pedagogicalReferentId ?? ""} className="input">
                <option value="">—</option>
                {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          )}
        </div>
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
        <h2>Informations réglementaires & financement</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Modalité">
            <select name="modality" defaultValue={course?.modality ?? "FOAD"} className="input">
              <option value="FOAD">À distance (FOAD)</option>
              <option value="PRESENTIEL">Présentiel</option>
              <option value="MIXTE">Mixte</option>
            </select>
          </Field>
          <Field label="Code RNCP / RS">
            <input name="rncpCode" defaultValue={course?.rncpCode ?? ""} className="input" placeholder="RS1234" />
          </Field>
          <Field label="Tarif HT (€)">
            <input name="price" type="number" step="0.01" min="0" defaultValue={course?.price ?? ""} className="input" />
          </Field>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input type="checkbox" name="cpfEligible" defaultChecked={course?.cpfEligible ?? false} className="accent-brand-600" />
            Éligible CPF
          </label>
        </div>
        <div>
          <span className="label">Justificatifs exigés pour candidater</span>
          <p className="hint mb-2">Si aucun n&apos;est coché, la liste par défaut de l&apos;organisme s&apos;applique.</p>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(DOCUMENT_TYPES).map(([code, d]) => (
              <label key={code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="requiredDocuments" value={code} defaultChecked={course?.requiredDocuments?.includes(code)} className="accent-brand-600" />
                {d.label}
              </label>
            ))}
          </div>
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
            <select name="enrollmentPolicy" defaultValue={course?.enrollmentPolicy ?? "APPLICATION"} className="input">
              <option value="APPLICATION">Sur dossier de candidature (vérifié par l&apos;OF)</option>
              <option value="INVITE">Sur invitation (l&apos;OF inscrit directement les apprenants)</option>
              <option value="OPEN">Libre (inscription immédiate depuis le catalogue)</option>
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
