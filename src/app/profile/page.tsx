import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { changePasswordAction, updateProfileAction } from "@/app/actions/admin";
import { saveProfileAction } from "@/app/actions/applications";
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
  const [u, profile, events, sessions] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, include: { organization: { select: { name: true } } } }),
    db.learnerProfile.findUnique({ where: { userId: user.id } }),
    db.loginEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    db.activitySession.findMany({ where: { userId: user.id }, orderBy: { startedAt: "desc" }, take: 15 }),
  ]);
  return (
    <Container className="max-w-5xl space-y-6">
      <PageHeader title="Mon profil" subtitle={`${u.email} · ${ROLE_LABELS[u.role]}${u.organization ? ` · ${u.organization.name}` : ""}`} />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4">Compte</h2>
          <StateForm action={updateProfileAction}>
            <Field label="Nom affiché"><input name="name" defaultValue={u.name} className="input" /></Field>
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

      {u.role === "LEARNER" && (
        <section className="card p-6">
          <h2 className="mb-1">Informations administratives</h2>
          <p className="mb-4 text-sm text-slate-500">Réutilisées automatiquement dans vos dossiers de candidature.</p>
          <ProfileForm action={saveProfileAction.bind(null, null)} profile={toProfileData(profile)} />
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
