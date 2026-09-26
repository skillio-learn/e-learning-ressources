import type { TrainingSession } from "@prisma/client";
import { Field } from "@/components/ui";

const iso = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** Champs d'une session : type (inter / intra), modalité, dates, lieu, logistique, formateur, tarif. */
export function SessionFields({
  session,
  companies,
  team,
}: {
  session?: Partial<TrainingSession>;
  companies: { id: string; name: string }[];
  team: { id: string; name: string }[];
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type de session">
          <select name="format" defaultValue={session?.format ?? "INTER"} className="input">
            <option value="INTER">Inter-entreprises (ouverte à plusieurs structures)</option>
            <option value="INTRA">Intra-entreprise (une entreprise cliente)</option>
          </select>
        </Field>
        <Field label="Entreprise cliente (intra)">
          <select name="companyId" defaultValue={session?.companyId ?? ""} className="input">
            <option value="">—</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Modalité">
          <select name="modality" defaultValue={session?.modality ?? ""} className="input">
            <option value="">Celle de la formation</option>
            <option value="PRESENTIEL">Présentiel</option>
            <option value="FOAD">À distance</option>
            <option value="MIXTE">Mixte</option>
          </select>
        </Field>
        <Field label="Nom de la session"><input name="name" defaultValue={session?.name ?? ""} className="input" placeholder="Ex. Session octobre 2026" /></Field>
        <Field label="Début"><input type="date" name="startDate" required defaultValue={iso(session?.startDate)} className="input" /></Field>
        <Field label="Fin"><input type="date" name="endDate" required defaultValue={iso(session?.endDate)} className="input" /></Field>
        <Field label="Places (maximum)"><input name="capacity" type="number" min={1} defaultValue={session?.capacity ?? ""} className="input" /></Field>
        <Field label="Minimum pour maintenir la session"><input name="minParticipants" type="number" min={1} defaultValue={session?.minParticipants ?? ""} className="input" /></Field>
        <Field label="Formateur"><select name="trainerId" defaultValue={session?.trainerId ?? ""} className="input"><option value="">—</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Prix HT de la session (intra) ou par stagiaire (inter)"><input name="price" inputMode="decimal" defaultValue={session?.price ?? ""} className="input" /></Field>
      </div>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="label">Lieu (présentiel)</legend>
        <Field label="Adresse"><input name="address" defaultValue={session?.address ?? ""} className="input" /></Field>
        <Field label="Salle"><input name="room" defaultValue={session?.room ?? ""} className="input" /></Field>
        <Field label="Code postal"><input name="postalCode" defaultValue={session?.postalCode ?? ""} className="input" /></Field>
        <Field label="Ville"><input name="city" defaultValue={session?.city ?? ""} className="input" /></Field>
        <Field label="Lieu affiché (ou « À distance »)"><input name="location" defaultValue={session?.location ?? ""} className="input" /></Field>
      </fieldset>
      <Field label="Informations pratiques (accès, horaires, repas, matériel)" hint="Reprises dans la convocation (Qualiopi, indicateur 9).">
        <textarea name="accessInfo" rows={3} defaultValue={session?.accessInfo ?? ""} className="input" />
      </Field>
    </>
  );
}
