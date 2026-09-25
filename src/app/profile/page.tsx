import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { changePasswordAction, updateProfileAction } from "@/app/actions/admin";
import { saveProfileAction } from "@/app/actions/applications";
import { cancelProfileChangeAction, requestProfileChangeAction } from "@/app/actions/profile";
import { ChangeDiff } from "@/components/profile/ChangeDiff";
import { CHANGE_REQUEST_STATUS, learnerProfileEditable } from "@/lib/labels";
import { Lock } from "lucide-react";
import { requestDeletionAction } from "@/app/actions/learner-extra";
import { ProfileForm } from "@/components/applications/ProfileForm";
import { StateForm } from "@/components/StateForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Container, Field, PageHeader } from "@/components/ui";
import { toProfileData } from "@/lib/profile";
import { formatDuration } from "@/lib/labels";
import { formatDate, ROLE_LABELS } from "@/lib/utils";

export const metadata = { title: "Mon profil" };
export const dynamic = "force-dynamic";

const EVENT_LABEL = { LOGIN: "Connexion", LOGOUT: "Déconnexion", FAILED: "Échec de connexion", LOCKED: "Compte verrouillé" } as const;

export default async function Profile() {
  const user = await requireUser();
  const [u, profile, events, sessions, requests] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, include: { organization: { select: { name: true } } } }),
    db.learnerProfile.findUnique({ where: { userId: user.id } }),
    db.loginEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    db.activitySession.findMany({ where: { userId: user.id }, orderBy: { startedAt: "desc" }, take: 15 }),
    db.profileChangeRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, changes: true, reason: true, status: true, reviewNote: true, createdAt: true, reviewedAt: true, fileName: true },
    }),
  ]);
  const learner = u.role === "LEARNER";
  const editable = learner && learnerProfileEditable(u.accountStatus);
  const pending = requests.find((r) => r.status === "PENDING");
  return (
    <Container className="max-w-5xl space-y-6">
      <PageHeader title="Mon profil" subtitle={`${u.email} · ${ROLE_LABELS[u.role]}${u.organization ? ` · ${u.organization.name}` : ""}`} />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4">Compte</h2>
          <StateForm action={updateProfileAction}>
            {learner ? (
              <Field label="Nom" hint="Issu de votre état civil : modifiable uniquement par demande à votre organisme.">
                <input value={u.name} disabled className="input" />
              </Field>
            ) : (
              <Field label="Nom affiché"><input name="name" defaultValue={u.name} className="input" /></Field>
            )}
            <Field label="Présentation"><textarea name="bio" rows={3} defaultValue={u.bio ?? ""} className="input" /></Field>
          </StateForm>
        </div>
        <div className="card p-6">
          <h2 className="mb-4">Mot de passe</h2>
          <StateForm action={changePasswordAction} submitLabel="Modifier le mot de passe">
            <Field label="Mot de passe actuel"><input name="current" type="password" required className="input" autoComplete="current-password" /></Field>
            <Field label="Nouveau mot de passe" hint="8 caractères minimum dont une lettre et un chiffre.">
              <input name="next" type="password" required minLength={8} className="input" autoComplete="new-password" />
            </Field>
          </StateForm>
        </div>
      </div>

      {learner && editable && (
        <section className="card p-6">
          <h2 className="mb-1">Informations administratives</h2>
          <p className="mb-4 text-sm text-slate-500">Réutilisées automatiquement dans vos dossiers de candidature.</p>
          <ProfileForm action={saveProfileAction.bind(null, null)} profile={toProfileData(profile)} />
        </section>
      )}

      {learner && !editable && (
        <section className="card space-y-5 p-6">
          <div>
            <h2 className="mb-1 flex items-center gap-2"><Lock className="h-4 w-4 text-slate-400" strokeWidth={1.75} /> Informations administratives</h2>
            <p className="text-sm text-slate-500">
              Vérifiées par votre organisme de formation, elles servent aux conventions, attestations et justificatifs transmis aux financeurs.
              Pour les corriger, envoyez une demande de modification avec un justificatif : l&apos;organisme la valide avant qu&apos;elle ne soit appliquée.
            </p>
          </div>
          <ProfileForm action={saveProfileAction.bind(null, null)} profile={toProfileData(profile)} disabled />

          {pending ? (
            <div className="rounded-2xl bg-amber-50/70 p-4 ring-1 ring-inset ring-amber-200">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <b className="text-sm text-amber-900">Demande envoyée le {formatDate(pending.createdAt, true)} – en attente de l&apos;organisme</b>
                <form action={cancelProfileChangeAction.bind(null, pending.id)}>
                  <SubmitButton className="btn-ghost btn-sm" confirm="Annuler cette demande ?">Annuler la demande</SubmitButton>
                </form>
              </div>
              <ChangeDiff changes={pending.changes} />
              <p className="mt-2 text-xs text-slate-600">Motif : {pending.reason}</p>
            </div>
          ) : (
            <details className="rounded-2xl border border-slate-200 p-4">
              <summary className="cursor-pointer font-medium text-slate-900">Demander une modification</summary>
              <p className="mb-4 mt-2 text-sm text-slate-500">Corrigez les informations concernées, indiquez le motif et joignez un justificatif (pièce d&apos;identité, justificatif de domicile, attestation employeur…).</p>
              <ProfileForm
                action={requestProfileChangeAction}
                profile={toProfileData(profile)}
                submitLabel="Envoyer la demande à mon organisme"
                extra={
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Motif de la modification *"><textarea name="reason" required minLength={10} rows={3} className="input" placeholder="ex. Déménagement, erreur de saisie, changement d'employeur…" /></Field>
                    <Field label="Justificatif" hint="PDF ou photo, 4 Mo maximum."><input type="file" name="proof" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" className="input" /></Field>
                  </div>
                }
              />
            </details>
          )}

          {requests.filter((r) => r.status !== "PENDING").length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Historique des demandes</h3>
              <ul className="space-y-2 text-sm">
                {requests.filter((r) => r.status !== "PENDING").map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <span>{formatDate(r.createdAt)} · {Object.keys(r.changes as object).length} information(s){r.reviewNote ? ` · « ${r.reviewNote} »` : ""}</span>
                    <Badge tone={CHANGE_REQUEST_STATUS[r.status].tone}>{CHANGE_REQUEST_STATUS[r.status].label}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-3">Mes dernières connexions</h2>
          <table className="table">
            <thead><tr><th>Date</th><th>Évènement</th><th>IP</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="text-xs">{formatDate(e.createdAt, true)}</td>
                  <td>{e.type === "FAILED" || e.type === "LOCKED" ? <Badge tone="red">{EVENT_LABEL[e.type]}</Badge> : EVENT_LABEL[e.type]}</td>
                  <td className="text-xs text-slate-500">{e.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-6">
          <h2 className="mb-3">Mes sessions de travail</h2>
          <table className="table">
            <thead><tr><th>Début</th><th>Fin</th><th>Temps actif</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="text-xs">{formatDate(s.startedAt, true)}</td>
                  <td className="text-xs">{s.endedAt ? formatDate(s.endedAt, true) : <Badge tone="green">En cours</Badge>}</td>
                  <td>{formatDuration(s.activeSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-2">Mes données personnelles (RGPD)</h2>
        <p className="mb-4 text-sm text-slate-600">
          Vous disposez d&apos;un droit d&apos;accès, de rectification, de portabilité et d&apos;effacement de vos données. Certaines données
          (présence, temps de formation, évaluations) doivent être conservées par l&apos;organisme pour les contrôles des financeurs.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/me/export" className="btn-secondary">⬇ Télécharger mes données (JSON)</a>
          {u.deletionRequestedAt ? (
            <Badge tone="amber">Suppression demandée le {formatDate(u.deletionRequestedAt)}</Badge>
          ) : (
            <form action={requestDeletionAction}>
              <SubmitButton className="btn-ghost text-red-600" confirm="Confirmer la demande de suppression de votre compte ? L'organisme la traitera dans le respect des obligations légales de conservation.">
                Demander la suppression de mon compte
              </SubmitButton>
            </form>
          )}
        </div>
      </section>
    </Container>
  );
}
