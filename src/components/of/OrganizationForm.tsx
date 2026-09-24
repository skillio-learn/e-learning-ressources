import type { Organization } from "@prisma/client";
import { updateOrganizationAction } from "@/app/actions/of-admin";
import { StateForm } from "@/components/StateForm";
import { Field } from "@/components/ui";
import { DOCUMENT_TYPES } from "@/lib/labels";

export function OrganizationForm({ org }: { org: Organization }) {
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  return (
    <StateForm action={updateOrganizationAction.bind(null, org.id)} className="space-y-6" submitLabel="Enregistrer les paramètres">
      <section className="card grid gap-4 p-6 md:grid-cols-2">
        <h2 className="md:col-span-2">Identité & réglementaire</h2>
        <Field label="Nom commercial *"><input name="name" defaultValue={org.name} required className="input" /></Field>
        <Field label="Raison sociale"><input name="legalName" defaultValue={org.legalName ?? ""} className="input" /></Field>
        <Field label="SIRET (14 chiffres)"><input name="siret" defaultValue={org.siret ?? ""} className="input" /></Field>
        <Field label="N° de déclaration d'activité (NDA, 11 chiffres)"><input name="nda" defaultValue={org.nda ?? ""} className="input" /></Field>
        <Field label="Région / préfecture du NDA"><input name="ndaRegion" defaultValue={org.ndaRegion ?? ""} className="input" /></Field>
        <Field label="N° de certificat Qualiopi"><input name="qualiopiNumber" defaultValue={org.qualiopiNumber ?? ""} className="input" /></Field>
        <Field label="Date de certification Qualiopi"><input type="date" name="qualiopiDate" defaultValue={iso(org.qualiopiDate)} className="input" /></Field>
        <Field label="Logo (URL)"><input name="logoUrl" type="url" defaultValue={org.logoUrl ?? ""} className="input" /></Field>
      </section>
      <section className="card grid gap-4 p-6 md:grid-cols-3">
        <h2 className="md:col-span-3">Coordonnées</h2>
        <Field label="Adresse" className="md:col-span-3"><input name="address" defaultValue={org.address ?? ""} className="input" /></Field>
        <Field label="Code postal"><input name="postalCode" defaultValue={org.postalCode ?? ""} className="input" /></Field>
        <Field label="Ville"><input name="city" defaultValue={org.city ?? ""} className="input" /></Field>
        <Field label="Téléphone"><input name="phone" defaultValue={org.phone ?? ""} className="input" /></Field>
        <Field label="Email de contact"><input name="email" type="email" defaultValue={org.email ?? ""} className="input" /></Field>
        <Field label="Site web"><input name="website" type="url" defaultValue={org.website ?? ""} className="input" /></Field>
      </section>
      <section className="card grid gap-4 p-6 md:grid-cols-2">
        <h2 className="md:col-span-2">Signataire & documents contractuels</h2>
        <Field label="Nom du signataire des attestations"><input name="managerName" defaultValue={org.managerName ?? ""} className="input" /></Field>
        <Field label="Fonction du signataire"><input name="managerTitle" defaultValue={org.managerTitle ?? ""} className="input" /></Field>
        <Field label="Règlement intérieur (URL)"><input name="internalRulesUrl" type="url" defaultValue={org.internalRulesUrl ?? ""} className="input" /></Field>
                <Field label="Conditions générales de vente (URL)"><input name="cgvUrl" type="url" defaultValue={org.cgvUrl ?? ""} className="input" /></Field>
        <Field label="Référent handicap (nom, email, téléphone)"><input name="referentHandicap" defaultValue={org.referentHandicap ?? ""} className="input" /></Field>
        <Field label="Médiateur de la consommation (contrats particuliers)"><input name="mediatorInfo" defaultValue={org.mediatorInfo ?? ""} className="input" /></Field>
      </section>
      <section className="card space-y-4 p-6">
        <h2>Dossiers d&apos;inscription & traçabilité</h2>
        <div>
          <span className="label">Justificatifs demandés par défaut</span>
          <p className="hint mb-2">Chaque formation peut définir sa propre liste. Des pièces s&apos;ajoutent automatiquement selon le financement (CPF, France Travail, OPCO).</p>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(DOCUMENT_TYPES).map(([code, d]) => (
              <label key={code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="requiredDocuments" value={code} defaultChecked={org.requiredDocuments.includes(code)} className="accent-brand-600" />
                {d.label}
              </label>
            ))}
          </div>
        </div>
        <Field label="Délai d'inactivité avant pause du chronomètre (minutes)" hint="Au-delà, le temps n'est plus comptabilisé et l'apprenant doit confirmer sa présence.">
                    <input name="inactivityTimeoutMin" type="number" min={2} max={120} defaultValue={org.inactivityTimeoutMin} className="input max-w-[140px]" />
        </Field>
        <Field
          label="Délai d'inactivité dans un module interactif (minutes)"
          hint="L'activité à l'intérieur d'un module intégré (iframe) n'est visible que si le module inclut lms-bridge.js. Ce délai plus long évite de sous-compter le temps passé dans vos modules."
        >
          <input name="interactiveTimeoutMin" type="number" min={2} max={180} defaultValue={org.interactiveTimeoutMin} className="input max-w-[140px]" />
        </Field>
      </section>
    </StateForm>
  );
}
