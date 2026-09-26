import type { Company } from "@prisma/client";
import { Field } from "@/components/ui";

export function CompanyFields({ c }: { c?: Partial<Company> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nom"><input name="name" required defaultValue={c?.name} className="input" /></Field>
      <Field label="Raison sociale"><input name="legalName" defaultValue={c?.legalName ?? ""} className="input" /></Field>
      <Field label="SIRET"><input name="siret" defaultValue={c?.siret ?? ""} inputMode="numeric" className="input" /></Field>
      <Field label="OPCO"><input name="opcoName" defaultValue={c?.opcoName ?? ""} className="input" placeholder="Atlas, Opco EP, Akto…" /></Field>
      <Field label="Adresse"><input name="address" defaultValue={c?.address ?? ""} className="input" /></Field>
      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <Field label="Code postal"><input name="postalCode" defaultValue={c?.postalCode ?? ""} className="input" /></Field>
        <Field label="Ville"><input name="city" defaultValue={c?.city ?? ""} className="input" /></Field>
      </div>
      <Field label="Interlocuteur formation (RH)"><input name="contactName" defaultValue={c?.contactName ?? ""} className="input" /></Field>
      <Field label="E-mail"><input name="contactEmail" type="email" defaultValue={c?.contactEmail ?? ""} className="input" /></Field>
      <Field label="Téléphone"><input name="contactPhone" defaultValue={c?.contactPhone ?? ""} className="input" /></Field>
      <Field label="Notes internes"><textarea name="notes" rows={2} defaultValue={c?.notes ?? ""} className="input" /></Field>
    </div>
  );
}
