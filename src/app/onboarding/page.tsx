import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CheckCircle2, Circle, Clock3, ShieldCheck, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { accountChecklist } from "@/lib/onboarding";
import { toProfileData } from "@/lib/profile";
import { ACCESS_STATUS, ACCOUNT_STATUS } from "@/lib/labels";
import { saveProfileAction } from "@/app/actions/applications";
import { deleteAccountDocumentAction, submitAccountAction, uploadAccountDocumentAction } from "@/app/actions/accounts";
import { ProfileForm } from "@/components/applications/ProfileForm";
import { DocumentUpload } from "@/components/applications/DocumentUpload";
import { StateForm } from "@/components/StateForm";
import { Badge, Container } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Mon inscription à la plateforme" };
export const dynamic = "force-dynamic";

const STATE_BADGE = {
  VALIDATED: <Badge tone="green">Validée</Badge>,
  PENDING: <Badge tone="blue">À vérifier par l&apos;organisme</Badge>,
  REJECTED: <Badge tone="red">Refusée – à remplacer</Badge>,
  MISSING: <Badge tone="amber">À fournir</Badge>,
};

export default async function Onboarding() {
  const me = await requireUser();
  if (me.role !== "LEARNER" || me.accountStatus === "ACTIVE") redirect("/dashboard");
  const { user, missingFields, docs, blockers } = await accountChecklist(me.id);
  const status = user.accountStatus;
  const editable = status === "PENDING_PROFILE" || status === "PENDING_REVIEW";
  // Pendant la vérification par l'OF, le dossier est figé : seul l'OF peut demander des compléments
  const canEdit = status === "PENDING_PROFILE";
  const enrollments = await db.enrollment.findMany({
    where: { userId: me.id },
    orderBy: { enrolledAt: "desc" },
    select: { id: true, accessStatus: true, course: { select: { title: true } } },
  });
  const orgName = user.organization?.name ?? "l'équipe Vylia";
  const steps = [
    { n: 1, label: "Informations administratives", done: missingFields.length === 0 },
    { n: 2, label: "Pièces justificatives", done: docs.every((d) => d.state === "PENDING" || d.state === "VALIDATED") },
    { n: 3, label: "Validation par l'organisme", done: false },
  ];

  return (
    <Container className="max-w-4xl">
      <div className="mb-8 animate-fade-up">
        <div className="eyebrow">Inscription à la plateforme</div>
        <h1 className="mt-2 text-3xl font-medium tracking-tightest md:text-4xl">Bienvenue, {user.profile?.firstName ?? user.name.split(" ")[0]}</h1>
        <p className="mt-2 text-[15px] text-slate-500">
          Pour accéder à vos formations, complétez votre dossier administratif. {orgName} le vérifie puis valide votre compte.
        </p>
      </div>

      {/* Statut */}
      {status === "PENDING_REVIEW" && (
        <div className="card mb-6 flex items-start gap-4 border-brand-200 bg-brand-50 p-5">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.75} />
          <div className="text-sm">
            <div className="font-semibold text-slate-900">Dossier envoyé le {formatDate(user.accountSubmittedAt, true)} — en cours de vérification</div>
            <p className="mt-1 text-slate-600">Vous serez notifié(e) dès que {orgName} aura validé votre compte. Votre dossier est figé pendant la vérification : l&apos;organisme vous contactera si une correction est nécessaire.</p>
          </div>
        </div>
      )}
      {status === "PENDING_PROFILE" && user.accountReviewNote && (
        <div className="card mb-6 flex items-start gap-4 border-amber-200 bg-amber-50 p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={1.75} />
          <div className="text-sm">
            <div className="font-semibold text-slate-900">Compléments demandés par l&apos;organisme</div>
            <p className="mt-1 whitespace-pre-line text-slate-700">{user.accountReviewNote}</p>
          </div>
        </div>
      )}
      {status === "REJECTED" && (
        <div className="card mb-6 flex items-start gap-4 border-red-200 bg-red-50 p-5">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" strokeWidth={1.75} />
          <div className="text-sm">
            <div className="font-semibold text-slate-900">Votre inscription à la plateforme n&apos;a pas été acceptée</div>
            {user.accountReviewNote && <p className="mt-1 whitespace-pre-line text-slate-700">Motif : {user.accountReviewNote}</p>}
            <p className="mt-2 text-slate-600">Pour toute question, utilisez le chat d&apos;assistance (bouton en bas à droite).</p>
          </div>
        </div>
      )}

      {/* Étapes */}
      <ol className="mb-8 grid gap-3 sm:grid-cols-3">
        {steps.map((s) => {
          const current = !s.done && steps.slice(0, s.n - 1).every((p) => p.done);
          return (
            <li key={s.n} className={cn("card flex items-center gap-3 p-4", current && "ring-2 ring-brand-600/30")}>
              {s.done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" strokeWidth={1.75} />
              ) : s.n === 3 && status === "PENDING_REVIEW" ? (
                <Clock3 className="h-5 w-5 text-brand-600" strokeWidth={1.75} />
              ) : (
                <Circle className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
              )}
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Étape {s.n}</div>
                <div className="text-sm font-medium text-slate-900">{s.label}</div>
              </div>
            </li>
          );
        })}
      </ol>

      {editable && (
        <>
          <section className="card mb-6 p-6">
            <h2>1. Mes informations administratives</h2>
            <p className="mb-5 mt-1 text-sm text-slate-500">
              Exigées par les financeurs (OPCO, France Travail, Caisse des dépôts) et conservées pour vos futures inscriptions.
            </p>
            {missingFields.length > 0 && (
              <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">À compléter : {missingFields.join(", ")}</p>
            )}
            <ProfileForm action={saveProfileAction.bind(null, null)} profile={toProfileData(user.profile)} disabled={!canEdit} />
          </section>

          <section className="card mb-6 p-6">
            <h2>2. Mes pièces justificatives</h2>
            <p className="mb-5 mt-1 text-sm text-slate-500">PDF, photo ou document Word, 4 Mo maximum par fichier. Plusieurs fichiers possibles (recto / verso).</p>
            <ul className="space-y-4">
              {docs.map((d) => (
                <li key={d.type} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-900">{d.label}</div>
                      {d.hint && <div className="text-xs text-slate-500">{d.hint}</div>}
                    </div>
                    {STATE_BADGE[d.state]}
                  </div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {d.files.map((f) => (
                      <li key={f.id} className="flex flex-wrap items-center gap-2 text-slate-600">
                        <span className={cn("h-2 w-2 rounded-full", f.status === "VALIDATED" ? "bg-emerald-500" : f.status === "REJECTED" ? "bg-red-500" : "bg-slate-400")} />
                        <a href={`/api/learner-documents/${f.id}?inline=1`} target="_blank" className="link">{f.fileName}</a>
                        <span>{formatDate(f.createdAt, true)}</span>
                        {f.status === "REJECTED" && f.comment && <span className="text-red-600">Motif : {f.comment}</span>}
                        {canEdit && f.status === "PENDING" && f.source === "LEARNER_UPLOAD" && (
                          <form action={deleteAccountDocumentAction.bind(null, f.id)}>
                            <button className="text-red-600 hover:underline">Supprimer</button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canEdit && d.state !== "VALIDATED" && (
                    <div className="mt-3">
                      <DocumentUpload action={uploadAccountDocumentAction} type={d.type} label={d.files.length ? "Ajouter un fichier" : "Déposer"} />
                    </div>
                  )}
                </li>
              ))}
              {docs.length === 0 && <li className="text-sm text-slate-500">Aucune pièce n&apos;est exigée par votre organisme.</li>}
            </ul>
          </section>

          {status === "PENDING_PROFILE" && (
            <section className="card p-6">
              <h2>3. Envoyer mon dossier</h2>
              {blockers.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
                  {blockers.map((b) => <li key={b}>{b}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-emerald-700">Votre dossier est complet.</p>
              )}
              <StateForm action={submitAccountAction} submitLabel="Envoyer mon dossier à l'organisme" submitClassName="btn-primary" className="mt-4 space-y-4">
                <label className="flex items-start gap-2 text-sm text-slate-600">
                  <input type="checkbox" name="certify" className="mt-1" />
                  Je certifie l&apos;exactitude des informations et des pièces fournies.
                </label>
              </StateForm>
            </section>
          )}
        </>
      )}
      {status !== "REJECTED" && enrollments.length > 0 && (
        <section className="card mt-6 p-6">
          <h2>Mes formations à finaliser</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">
            Vous pouvez dès maintenant signer ou déposer vos documents d&apos;inscription. L&apos;accès aux formations s&apos;ouvre après la validation de votre compte et de vos documents.
          </p>
          <ul className="divide-y divide-slate-100">
            {enrollments.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="font-medium text-slate-900">{e.course.title}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={ACCESS_STATUS[e.accessStatus].tone}>{ACCESS_STATUS[e.accessStatus].label}</Badge>
                  <Link href={`/enrollments/${e.id}`} className="btn-secondary btn-sm">{e.accessStatus === "PENDING_DOCUMENTS" ? "Fournir mes documents" : "Voir"}</Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-8 text-center text-xs text-slate-400">Statut : {ACCOUNT_STATUS[status].label}</p>
    </Container>
  );
}
