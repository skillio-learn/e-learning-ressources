import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { canManageOrg } from "@/lib/permissions";
import { accountChecklist } from "@/lib/onboarding";
import {
  regenerateActivationLinkAction, rejectAccountAction, reopenAccountAction, requestAccountChangesAction,
  reviewAccountDocumentAction, staffUploadAccountDocumentAction, validateAccountAction,
} from "@/app/actions/accounts";
import { approveProfileChangeAction, rejectProfileChangeAction } from "@/app/actions/profile";
import { ChangeDiff } from "@/components/profile/ChangeDiff";
import { StateForm } from "@/components/StateForm";
import { SubmitButton } from "@/components/SubmitButton";
import { DocumentUpload } from "@/components/applications/DocumentUpload";
import { Badge, Container, PageHeader } from "@/components/ui";
import { ACCOUNT_DOCUMENT_CHOICES, ACCOUNT_STATUS, CHANGE_REQUEST_STATUS, DOC_SOURCE, DOCUMENT_TYPES, EMPLOYMENT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Validation de compte" };
export const dynamic = "force-dynamic";

export default async function AccountReview({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireOfManager();
  const { id } = await params;
  const learner = await db.user.findUnique({ where: { id }, select: { role: true, organizationId: true } });
  if (!learner || learner.role !== "LEARNER" || !canManageOrg(staff, learner.organizationId)) notFound();
  const { user, missingFields, docs, extraDocs } = await accountChecklist(id);
  const changeRequests = await db.profileChangeRequest.findMany({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, changes: true, reason: true, status: true, reviewNote: true, createdAt: true, reviewedAt: true, fileName: true, reviewedBy: { select: { name: true } } },
  });
  const pendingChange = changeRequests.find((r) => r.status === "PENDING");
  const reviewer = user.accountReviewedById ? await db.user.findUnique({ where: { id: user.accountReviewedById }, select: { name: true } }) : null;
  const p = user.profile;
  const st = ACCOUNT_STATUS[user.accountStatus];
  const rows: [string, React.ReactNode][] = [
    ["Civilité", p?.civility], ["Prénom", p?.firstName], ["Nom", p?.lastName], ["Nom de naissance", p?.birthName],
    ["Date de naissance", p?.birthDate ? formatDate(p.birthDate) : null], ["Lieu de naissance", p?.birthPlace], ["Nationalité", p?.nationality],
    ["Téléphone", p?.phone], ["Adresse", [p?.address, p?.postalCode, p?.city, p?.country].filter(Boolean).join(" ")],
    ["Situation professionnelle", p?.employmentStatus ? EMPLOYMENT_STATUS[p.employmentStatus] : null],
    ["Identifiant France Travail", p?.franceTravailId], ["Niveau de formation", p?.educationLevel], ["Dernier diplôme", p?.lastDiploma],
    ["Emploi actuel", p?.currentJob], ["Employeur", [p?.employerName, p?.employerSiret && `SIRET ${p.employerSiret}`].filter(Boolean).join(" · ")],
    ["OPCO", p?.opcoName], ["Situation de handicap", p?.disability ? `Oui — ${p.disabilityNeeds ?? "aménagements à définir"}` : "Non"],
  ];
  const decisionOpen = user.accountStatus === "PENDING_REVIEW" || user.accountStatus === "PENDING_PROFILE";

  return (
    <Container className="max-w-6xl">
      <PageHeader
        back={{ href: "/of/accounts", label: "Comptes apprenants" }}
        title={user.name}
        subtitle={`${user.email} · compte créé le ${formatDate(user.createdAt)} (${user.createdVia === "OF" ? "par l'OF" : user.createdVia === "ADMIN" ? "par Vylia" : "auto-inscription"})${user.organization ? ` · ${user.organization.name}` : ""}`}
        actions={<><Badge tone={st.tone}>{st.label}</Badge><Link href={`/of/learners/${user.id}`} className="btn-secondary btn-sm">Fiche apprenant</Link></>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {pendingChange && (
            <section className="card space-y-4 p-6 ring-2 ring-amber-200">
              <div>
                <h2 className="mb-1">Demande de modification des informations</h2>
                <p className="text-sm text-slate-500">Envoyée le {formatDate(pendingChange.createdAt, true)}. Vérifiez le justificatif avant d&apos;accepter : les nouvelles valeurs remplaceront les actuelles sur tous les documents.</p>
              </div>
              <ChangeDiff changes={pendingChange.changes} />
              <p className="text-sm text-slate-600"><b>Motif :</b> {pendingChange.reason}</p>
              {pendingChange.fileName ? (
                <a href={`/api/profile-changes/${pendingChange.id}/file?inline=1`} target="_blank" className="btn-secondary btn-sm">Voir le justificatif ({pendingChange.fileName})</a>
              ) : (
                <p className="text-xs text-amber-700">Aucun justificatif joint.</p>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <StateForm action={approveProfileChangeAction.bind(null, pendingChange.id)} submitLabel="Accepter et appliquer" submitClassName="btn-primary w-full" className="space-y-2">
                  <textarea name="note" rows={2} className="input" placeholder="Message à l'apprenant (facultatif)" />
                </StateForm>
                <StateForm action={rejectProfileChangeAction.bind(null, pendingChange.id)} submitLabel="Refuser" submitClassName="btn-secondary w-full" className="space-y-2">
                  <textarea name="note" rows={2} className="input" placeholder="Motif du refus (obligatoire)" />
                </StateForm>
              </div>
            </section>
          )}
          <section className="card p-6">
            <h2 className="mb-1">Informations administratives</h2>
            {missingFields.length > 0 ? (
              <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Manquant : {missingFields.join(", ")}</p>
            ) : (
              <p className="mb-4 text-sm text-emerald-700">Toutes les informations obligatoires sont renseignées.</p>
            )}
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-medium text-slate-900">{v || <span className="font-normal text-slate-500">—</span>}</dd>
                </div>
              ))}
            </dl>
            {changeRequests.some((r) => r.status !== "PENDING") && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-600">Historique des modifications demandées</h3>
                <ul className="space-y-2 text-sm">
                  {changeRequests.filter((r) => r.status !== "PENDING").map((r) => (
                    <li key={r.id} className="rounded-xl bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-slate-600">{formatDate(r.createdAt, true)}{r.reviewedBy ? ` · traitée par ${r.reviewedBy.name}` : ""}{r.reviewNote ? ` · « ${r.reviewNote} »` : ""}</span>
                        <Badge tone={CHANGE_REQUEST_STATUS[r.status].tone}>{CHANGE_REQUEST_STATUS[r.status].label}</Badge>
                      </div>
                      <details className="mt-1"><summary className="cursor-pointer text-xs text-slate-500">Détail</summary><ChangeDiff changes={r.changes} /></details>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="mb-4">Pièces justificatives</h2>
            <ul className="space-y-4">
              {[...docs.map((d) => ({ type: d.type, label: d.label, files: d.files, required: true })), ...(extraDocs.length ? [{ type: "_extra", label: "Autres pièces", files: extraDocs, required: false }] : [])].map((d) => (
                <li key={d.type} className="rounded-2xl border border-slate-200 p-4">
                  <div className="font-medium text-slate-900">{d.label} {d.required && <span className="text-xs font-normal text-slate-500">(obligatoire)</span>}</div>
                  {d.files.length === 0 && <p className="mt-1 text-sm text-amber-700">Non fournie</p>}
                  <ul className="mt-2 space-y-3">
                    {d.files.map((f) => (
                      <li key={f.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <a href={`/api/learner-documents/${f.id}?inline=1`} target="_blank" className="link font-medium">{f.fileName ?? "Document signé"}</a>
                          <span className="text-xs text-slate-500">{DOC_SOURCE[f.source as keyof typeof DOC_SOURCE]} · {formatDate(f.createdAt, true)}</span>
                          {f.status === "VALIDATED" ? <Badge tone="green">Validée</Badge> : f.status === "REJECTED" ? <Badge tone="red">Refusée</Badge> : <Badge tone="blue">À vérifier</Badge>}
                        </div>
                        {f.comment && <p className="mt-1 text-xs text-slate-600">Commentaire : {f.comment}</p>}
                        {f.status === "PENDING" && (
                          <StateForm action={reviewAccountDocumentAction.bind(null, f.id)} submitLabel="Enregistrer" submitClassName="btn-secondary btn-sm" className="mt-2 flex flex-wrap items-center gap-2">
                            <select name="status" className="input w-auto py-1.5 text-sm" defaultValue="VALIDATED">
                              <option value="VALIDATED">Valider</option>
                              <option value="REJECTED">Refuser</option>
                            </select>
                            <input name="comment" placeholder="Motif si refus (visible par l'apprenant)" className="input min-w-[220px] flex-1 py-1.5 text-sm" />
                          </StateForm>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="mb-2 text-sm font-medium text-slate-900">Ajouter une pièce au nom de l&apos;apprenant (validée d&apos;office)</div>
              <DocumentUpload
                action={staffUploadAccountDocumentAction.bind(null, user.id)}
                optionalTypes={ACCOUNT_DOCUMENT_CHOICES.map((c) => ({ code: c, label: DOCUMENT_TYPES[c].label }))}
                label="Ajouter"
              />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-3">Décision</h2>
            {user.accountSubmittedAt && <p className="text-sm text-slate-600">Dossier envoyé le {formatDate(user.accountSubmittedAt, true)}.</p>}
            {user.accountReviewedAt && (
              <p className="mt-1 text-sm text-slate-600">
                Dernière décision le {formatDate(user.accountReviewedAt, true)}{reviewer ? ` par ${reviewer.name}` : ""}.
                {user.accountReviewNote && <span className="mt-1 block whitespace-pre-line text-slate-500">« {user.accountReviewNote} »</span>}
              </p>
            )}
            {user.accountStatus === "PENDING_PROFILE" && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">L&apos;apprenant n&apos;a pas encore envoyé son dossier. Vous pouvez tout de même valider le compte s&apos;il est complet.</p>
            )}
            {decisionOpen && (
              <div className="mt-4 space-y-5">
                <StateForm action={validateAccountAction.bind(null, user.id)} submitLabel="Valider le compte" submitClassName="btn-primary w-full" className="space-y-2">
                  <p className="text-xs text-slate-500">Les pièces encore « à vérifier » seront validées avec le compte.</p>
                  <input name="note" placeholder="Note interne (facultative)" className="input" />
                </StateForm>
                <StateForm action={requestAccountChangesAction.bind(null, user.id)} submitLabel="Demander des compléments" submitClassName="btn-secondary w-full" className="space-y-2">
                  <textarea name="note" rows={3} required placeholder="Informations ou pièces attendues…" className="input" />
                </StateForm>
                <StateForm action={rejectAccountAction.bind(null, user.id)} submitLabel="Refuser l'inscription" submitClassName="btn-danger w-full" className="space-y-2">
                  <textarea name="note" rows={2} required placeholder="Motif du refus" className="input" />
                  <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="confirm" /> Je confirme le refus</label>
                </StateForm>
              </div>
            )}
            {user.accountStatus === "REJECTED" && (
              <form action={reopenAccountAction.bind(null, user.id)} className="mt-4">
                <SubmitButton className="btn-secondary w-full">Rouvrir le dossier</SubmitButton>
              </form>
            )}
          </section>
          <section className="card p-6">
            <h2 className="mb-2 text-base">Accès au compte</h2>
            <p className="mb-3 text-xs text-slate-500">Génère un lien (7 jours) permettant à l&apos;apprenant de définir son mot de passe.</p>
            <StateForm action={regenerateActivationLinkAction.bind(null, user.id)} submitLabel="Générer un lien d'activation" submitClassName="btn-secondary btn-sm w-full">
              <span />
            </StateForm>
          </section>
        </aside>
      </div>
    </Container>
  );
}
