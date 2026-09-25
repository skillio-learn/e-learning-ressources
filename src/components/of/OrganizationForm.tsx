import type { Organization } from "@prisma/client";
import { updateOrganizationAction } from "@/app/actions/of-admin";
import { StateForm } from "@/components/StateForm";
import { Field } from "@/components/ui";
import { ACCOUNT_DOCUMENT_CHOICES, ENROLLMENT_DOCUMENTS, DOCUMENT_TYPES } from "@/lib/labels";

/** « managers » : responsables de l'OF, candidats au rôle de référent support Vylia. */
export function OrganizationForm({ org, managers = [] }: { org: Organization; managers?: { id: string; name: string; email: string }[] }) {
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

      <section className="card space-y-4 p-6">
        <h2>Inscription à la plateforme</h2>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="requireAccountValidation" defaultChecked={org.requireAccountValidation} className="mt-1" />
          <span><b>Valider chaque compte apprenant</b> avant qu&apos;il accède à la plateforme (recommandé). Sinon, le compte est actif dès l&apos;envoi du dossier complet.</span>
        </label>
        <div>
          <span className="label">Pièces demandées à la création du compte</span>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {ACCOUNT_DOCUMENT_CHOICES.map((code) => (
              <label key={code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="accountRequiredDocuments" value={code} defaultChecked={org.accountRequiredDocuments.includes(code)} />
                {DOCUMENT_TYPES[code].label}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2>Accès aux parcours</h2>
        <div>
          <span className="label">Documents d&apos;inscription exigés avant l&apos;ouverture de l&apos;accès</span>
          <div className="grid gap-1 sm:grid-cols-2">
            {Object.entries(ENROLLMENT_DOCUMENTS).map(([code, d]) => (
              <label key={code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="enrollmentRequiredDocuments" value={code} defaultChecked={org.enrollmentRequiredDocuments.includes(code)} />
                {d.label}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="autoGrantAccess" defaultChecked={org.autoGrantAccess} className="mt-1" />
          <span>Ouvrir l&apos;accès <b>automatiquement</b> dès que tous les documents sont validés (sinon, ouverture manuelle).</span>
        </label>
        <Field label="Conditions générales de vente — texte signé en ligne (Markdown)" hint="Si renseigné, l'apprenant peut lire et signer les CGV sur la plateforme ; la version signée est archivée avec son empreinte.">
          <textarea name="cgvText" rows={8} defaultValue={org.cgvText ?? ""} className="input font-mono text-xs" />
        </Field>
        <Field label="Règlement intérieur — texte signé en ligne (Markdown)" hint="Art. L.6352-3 et R.6352-1 du Code du travail.">
          <textarea name="internalRulesText" rows={8} defaultValue={org.internalRulesText ?? ""} className="input font-mono text-xs" />
        </Field>
      </section>

      <section className="card space-y-4 p-6">
        <h2>Chat d&apos;assistance</h2>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="supportEnabled" defaultChecked={org.supportEnabled} className="mt-1" />
          <span>Activer le chat d&apos;assistance pour vos apprenants</span>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Horaires de l'assistance" hint="ex. Du lundi au vendredi, 9 h – 18 h">
            <input name="supportHours" defaultValue={org.supportHours ?? ""} className="input" />
          </Field>
          <Field label="Engagement de première réponse (heures ouvrées)">
            <input name="supportResponseHours" type="number" min={1} max={168} defaultValue={org.supportResponseHours} className="input max-w-[140px]" />
          </Field>
        </div>
        <Field label="Message automatique à l'ouverture d'une conversation" hint="Laisser vide pour le message par défaut (horaires et délai).">
          <textarea name="supportAutoReply" rows={3} defaultValue={org.supportAutoReply ?? ""} className="input" />
        </Field>
      </section>

      <section className="card space-y-4 p-6">
        <h2>Support Vylia</h2>
        <Field
          label="Référent support de l'organisme"
          hint="Interlocuteur du support Vylia : il reçoit les réponses et les résolutions de tous les tickets de l'organisme."
        >
          <select name="supportReferentId" defaultValue={org.supportReferentId ?? ""} className="input max-w-md">
            <option value="">— Aucun (chaque responsable suit ses tickets) —</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
          </select>
        </Field>
      </section>
    </StateForm>
  );
}
