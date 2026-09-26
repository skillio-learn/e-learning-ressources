import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { OrganizationForm } from "@/components/of/OrganizationForm";
import { Container, PageHeader } from "@/components/ui";
import { SignaturePad } from "@/components/SignaturePad";
import { SubmitButton } from "@/components/SubmitButton";
import { clearOrgSignatureAction, saveOrgSignatureAction } from "@/app/actions/compliance";
import { createWebhookAction, deleteWebhookAction, generateInternalRulesAction, saveOrgPoliciesAction, testWebhookAction, toggleWebhookAction } from "@/app/actions/org-settings";
import { StateForm } from "@/components/StateForm";
import { Badge, Field } from "@/components/ui";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Paramètres de l'OF" };
export const dynamic = "force-dynamic";

export default async function OfSettings() {
  const user = await requireOfManager();
  if (!user.organizationId) notFound();
  const [org, managers, webhooks] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId } }),
    db.user.findMany({ where: { organizationId: user.organizationId, role: "OF_ADMIN", active: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    db.webhook.findMany({ where: { organizationId: user.organizationId }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <Container className="max-w-4xl">
      <PageHeader title="Paramètres de l'organisme" subtitle="Ces informations apparaissent sur les attestations, certificats de réalisation et relevés de connexion." />
      <OrganizationForm org={org} managers={managers} />
      <section className="card mt-6 p-6">
        <h2 className="mb-1">Signature de l&apos;organisme</h2>
        <p className="mb-3 text-sm text-slate-500">Apposée automatiquement sur les conventions, convocations, attestations et certificats de réalisation.</p>
        {org.signatureImage ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={org.signatureImage} alt="Signature" className="paper-sign h-20" />
            <form action={clearOrgSignatureAction.bind(null, org.id)}><SubmitButton className="btn-ghost btn-sm text-red-600">Supprimer</SubmitButton></form>
          </div>
        ) : (
          <div className="max-w-md"><SignaturePad onSign={saveOrgSignatureAction.bind(null, org.id)} label="Enregistrer la signature" /></div>
        )}
      </section>
      <section className="card mt-6 p-6">
        <h2 className="mb-1">Règlement intérieur des stagiaires</h2>
        <p className="mb-3 text-sm text-slate-500">
          Obligatoire (articles L.6352-3 et R.6352-1 et suivants du Code du travail). Vylia propose un modèle complet : hygiène et sécurité, discipline, sanctions et
          procédure disciplinaire, représentation des stagiaires, procédure de signalement des violences sexistes et sexuelles, du harcèlement et des discriminations.
          Relisez-le et adaptez-le dans le champ « Règlement intérieur » ci-dessus.
        </p>
        <form action={generateInternalRulesAction}>
          <SubmitButton className="btn-secondary" confirm={org.internalRulesText ? "Remplacer le texte actuel par le modèle Vylia ?" : undefined}>
            {org.internalRulesText ? "Remplacer par le modèle Vylia" : "Générer le règlement intérieur"}
          </SubmitButton>
        </form>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="mb-1">Sécurité et absences</h2>
        <StateForm action={saveOrgPoliciesAction} submitLabel="Enregistrer" submitClassName="btn-primary" className="mt-3 space-y-3">
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="mfaRequired" defaultChecked={org.mfaRequired} className="mt-0.5 h-4 w-4" /> Double authentification obligatoire pour les responsables et formateurs de l&apos;organisme</label>
          <Field label="Alerte d'absences à partir de (demi-journées non justifiées, 0 = désactivé)"><input name="absenceAlertThreshold" type="number" min={0} max={20} defaultValue={org.absenceAlertThreshold} className="input max-w-32" /></Field>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="notifyEmployerOnAbsence" defaultChecked={org.notifyEmployerOnAbsence} className="mt-0.5 h-4 w-4" /> Prévenir aussi l&apos;entreprise du stagiaire (si elle a un espace et que ce partage est activé sur sa fiche)</label>
        </StateForm>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="mb-1">Automatisations : webhooks Make, Zapier, n8n</h2>
        <p className="mb-3 text-sm text-slate-500">
          Vylia envoie un message JSON signé (en-tête X-Vylia-Signature : HMAC SHA-256 de « horodatage.corps ») à chaque événement choisi. Collez l&apos;adresse
          d&apos;un scénario Make (« Custom webhook ») ou d&apos;un Zap (« Webhooks by Zapier, Catch Hook »).
        </p>
        <ul className="divide-y divide-slate-100 text-sm">
          {webhooks.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-900">{h.description || h.url}</div>
                <div className="truncate text-xs text-slate-500">{h.url} · {h.events.join(", ")}</div>
                {h.lastAt && <div className="text-xs text-slate-500">Dernier envoi le {formatDate(h.lastAt, true)} : {h.lastError ? <span className="text-red-600">{h.lastError}</span> : `HTTP ${h.lastStatus}`}</div>}
              </div>
              {!h.active && <Badge>Désactivé</Badge>}
              <form action={testWebhookAction.bind(null, h.id)}><SubmitButton className="btn-ghost btn-sm">Tester</SubmitButton></form>
              <form action={toggleWebhookAction.bind(null, h.id)}><SubmitButton className="btn-ghost btn-sm">{h.active ? "Désactiver" : "Activer"}</SubmitButton></form>
              <form action={deleteWebhookAction.bind(null, h.id)}><SubmitButton className="btn-ghost btn-sm text-red-600" confirm="Supprimer ce webhook ?">Supprimer</SubmitButton></form>
            </li>
          ))}
          {!webhooks.length && <li className="py-2 text-slate-500">Aucun webhook.</li>}
        </ul>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-brand-600">Ajouter un webhook</summary>
          <StateForm action={createWebhookAction} submitLabel="Créer le webhook" submitClassName="btn-secondary" className="mt-3 space-y-3">
            <Field label="Adresse (https://…)"><input name="url" type="url" required className="input" placeholder="https://hook.eu1.make.com/…" /></Field>
            <Field label="Nom (facultatif)"><input name="description" className="input" placeholder="Ex. : CRM, tableau de suivi" /></Field>
            <fieldset className="grid gap-2 text-sm sm:grid-cols-2">
              {Object.values(WEBHOOK_EVENTS).map((e) => (
                <label key={e.event} className="flex items-start gap-2"><input type="checkbox" name="events" value={e.event} className="mt-0.5 h-4 w-4" /> {e.label}</label>
              ))}
            </fieldset>
          </StateForm>
        </details>
      </section>
    </Container>
  );
}
