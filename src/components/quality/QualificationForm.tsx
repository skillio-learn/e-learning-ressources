import { addQualificationAction } from "@/app/actions/quality";
import { StateForm } from "@/components/StateForm";
import { Field } from "@/components/ui";
import { ACCEPT_ATTR } from "@/lib/uploads";

export const QUALIF_KINDS: Record<string, string> = {
  CV: "CV",
  DIPLOMA: "Diplôme",
  CERTIFICATION: "Certification / habilitation",
  EXPERIENCE: "Expérience professionnelle",
  TRAINING: "Formation suivie (développement des compétences)",
};

/** Dépôt d'un justificatif de compétence (par le formateur ou pour lui par le référent qualité). */
export function QualificationForm({ userId }: { userId?: string }) {
  return (
    <StateForm action={addQualificationAction} submitLabel="Ajouter le justificatif" submitClassName="btn-primary" className="space-y-3">
      {userId && <input type="hidden" name="userId" value={userId} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type"><select name="kind" className="input">{Object.entries(QUALIF_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Intitulé"><input name="title" required maxLength={200} className="input" placeholder="Ex. Titre professionnel Formateur pour adultes" /></Field>
        <Field label="Organisme ou employeur"><input name="issuer" className="input" /></Field>
        <Field label="Date d'obtention"><input type="date" name="obtainedAt" className="input" /></Field>
        <Field label="Date d'expiration (le cas échéant)"><input type="date" name="expiresAt" className="input" /></Field>
        <Field label="Justificatif (4 Mo max., obligatoire pour un CV)"><input type="file" name="file" accept={ACCEPT_ATTR.document} className="text-sm" /></Field>
      </div>
    </StateForm>
  );
}
