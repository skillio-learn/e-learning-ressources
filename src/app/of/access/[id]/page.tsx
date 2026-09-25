import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { canManageOrg } from "@/lib/permissions";
import { accessChecklist } from "@/lib/onboarding";
import { grantAccessAction, refuseAccessAction, reopenAccessAction, reviewEnrollmentDocumentAction, uploadEnrollmentDocumentAction } from "@/app/actions/access";
import { StateForm } from "@/components/StateForm";
import { SubmitButton } from "@/components/SubmitButton";
import { DocumentUpload } from "@/components/applications/DocumentUpload";
import { Badge, Container, PageHeader } from "@/components/ui";
import { ACCESS_STATUS, ACCOUNT_STATUS, DOC_SOURCE, ENROLLMENT_DOCUMENTS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Accès au parcours" };
export const dynamic = "force-dynamic";

const ORIGIN: Record<string, string> = { OF: "inscrit par l'OF", APPLICATION: "suite à candidature", SELF: "demande de l'apprenant" };

export default async function AccessReview({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireOfManager();
  const { id } = await params;
  const owner = await db.enrollment.findUnique({ where: { id }, select: { course: { select: { organizationId: true } } } });
  if (!owner || !canManageOrg(staff, owner.course.organizationId)) notFound();
  const { enrollment: e, items, allValidated, extraDocs } = await accessChecklist(id);
  const st = ACCESS_STATUS[e.accessStatus];
  const acc = ACCOUNT_STATUS[e.user.accountStatus];
  const docLink = (f: { id: string; source: string; type: string }) =>
    f.source === "E_SIGNATURE" ? (f.type === "CONVENTION" ? `/documents/convention/${e.id}` : `/documents/signed/${f.id}`) : `/api/learner-documents/${f.id}?inline=1`;
  const all = [...items.map((i) => ({ ...i, required: true })), ...(extraDocs.length ? [{ type: "_extra", label: "Autres documents", hint: "", files: extraDocs, state: "PENDING" as const, required: false }] : [])];

  return (
    <Container className="max-w-6xl">
      <PageHeader
        back={{ href: "/of/access", label: "Accès aux parcours" }}
        title={e.user.name}
        subtitle={`${e.course.title} · inscrit le ${formatDate(e.enrolledAt)} (${ORIGIN[e.origin] ?? e.origin})`}
        actions={<><Badge tone={st.tone}>{st.label}</Badge><Link href={`/of/learners/${e.user.id}`} className="btn-secondary btn-sm">Fiche apprenant</Link></>}
      />
      {e.user.accountStatus !== "ACTIVE" && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50 p-4 text-sm">
          <span>Compte apprenant : <b>{acc.label}</b>. L&apos;accès ne peut être ouvert qu&apos;après validation du compte.</span>
          <Link href={`/of/accounts/${e.user.id}`} className="btn-secondary btn-sm">Examiner le compte</Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-6">
          <h2 className="mb-4">Documents d&apos;inscription</h2>
          <ul className="space-y-4">
            {all.map((it) => (
              <li key={it.type} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-900">{it.label}</div>
                  {it.required &&
                    (it.state === "VALIDATED" ? <Badge tone="green">Validé</Badge> : it.state === "PENDING" ? <Badge tone="blue">À vérifier</Badge> : it.state === "REJECTED" ? <Badge tone="red">Refusé</Badge> : <Badge tone="amber">Non fourni</Badge>)}
                </div>
                <ul className="mt-2 space-y-3">
                  {it.files.map((f) => (
                    <li key={f.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={docLink(f)} target="_blank" className="link font-medium">{f.source === "E_SIGNATURE" ? "Signature électronique" : f.fileName}</a>
                        <span className="text-xs text-slate-500">
                          {DOC_SOURCE[f.source as keyof typeof DOC_SOURCE]}{f.uploadedBy ? ` (${f.uploadedBy.name})` : ""} · {formatDate(f.createdAt, true)}
                          {f.source === "E_SIGNATURE" && f.signedIp ? ` · IP ${f.signedIp}` : ""}
                        </span>
                        {f.status === "VALIDATED" ? <Badge tone="green">Validé</Badge> : f.status === "REJECTED" ? <Badge tone="red">Refusé</Badge> : <Badge tone="blue">À vérifier</Badge>}
                      </div>
                      {f.reviewedBy && <p className="mt-1 text-xs text-slate-500">Vérifié par {f.reviewedBy.name} le {formatDate(f.reviewedAt, true)}{f.comment ? ` — ${f.comment}` : ""}</p>}
                      {f.status === "PENDING" && (
                        <StateForm action={reviewEnrollmentDocumentAction.bind(null, f.id)} submitLabel="Enregistrer" submitClassName="btn-secondary btn-sm" className="mt-2 flex flex-wrap items-center gap-2">
                          <select name="status" className="input w-auto py-1.5 text-sm" defaultValue="VALIDATED">
                            <option value="VALIDATED">Valider</option>
                            <option value="REJECTED">Refuser</option>
                          </select>
                          <input name="comment" placeholder="Motif si refus (visible par l'apprenant)" className="input min-w-[220px] flex-1 py-1.5 text-sm" />
                        </StateForm>
                      )}
                    </li>
                  ))}
                  {it.files.length === 0 && <li className="text-sm text-slate-500">Aucun document.</li>}
                </ul>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="mb-2 text-sm font-medium text-slate-900">Déposer un document au nom de l&apos;apprenant (validé d&apos;office)</div>
            <DocumentUpload
              action={uploadEnrollmentDocumentAction.bind(null, e.id)}
              optionalTypes={Object.entries(ENROLLMENT_DOCUMENTS).map(([code, d]) => ({ code, label: d.label }))}
              label="Déposer"
            />
            <p className="mt-2 text-xs text-slate-500">
              Documents contractuels : <Link href={`/documents/convention/${e.id}`} className="link">convention / contrat</Link> ·{" "}
              <Link href={`/documents/convocation/${e.id}`} className="link">convocation</Link>
            </p>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-3">Décision d&apos;accès</h2>
            {e.accessSubmittedAt && <p className="text-sm text-slate-600">Dossier complet le {formatDate(e.accessSubmittedAt, true)}.</p>}
            {e.accessDecidedAt && (
              <p className="mt-1 text-sm text-slate-600">
                Dernière décision le {formatDate(e.accessDecidedAt, true)}{e.accessDecidedBy ? ` par ${e.accessDecidedBy.name}` : ""}.
                {e.accessDecisionNote && <span className="mt-1 block whitespace-pre-line text-slate-500">« {e.accessDecisionNote} »</span>}
              </p>
            )}
            {e.accessStatus !== "GRANTED" && e.accessStatus !== "REFUSED" && (
              <div className="mt-4 space-y-5">
                <StateForm action={grantAccessAction.bind(null, e.id)} submitLabel="Ouvrir l'accès à la formation" submitClassName="btn-primary w-full" className="space-y-2">
                  {!allValidated && <p className="text-xs text-amber-700">Tous les documents obligatoires doivent être validés.</p>}
                  <input name="note" placeholder="Note (facultative)" className="input" />
                </StateForm>
                <StateForm action={refuseAccessAction.bind(null, e.id)} submitLabel="Refuser l'accès" submitClassName="btn-danger w-full" className="space-y-2">
                  <textarea name="note" rows={2} required placeholder="Motif du refus (visible par l'apprenant)" className="input" />
                  <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="confirm" /> Je confirme le refus</label>
                </StateForm>
              </div>
            )}
            {e.accessStatus === "GRANTED" && (
              <div className="mt-4 space-y-4">
                <Link href={`/learn/${e.course.slug}`} className="btn-secondary w-full">Voir le parcours</Link>
                <StateForm action={refuseAccessAction.bind(null, e.id)} submitLabel="Retirer l'accès" submitClassName="btn-danger w-full" className="space-y-2">
                  <textarea name="note" rows={2} required placeholder="Motif (visible par l'apprenant)" className="input" />
                  <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="confirm" /> Je confirme le retrait</label>
                </StateForm>
              </div>
            )}
            {(e.accessStatus === "REFUSED" || e.accessStatus === "GRANTED") && (
              <form action={reopenAccessAction.bind(null, e.id)} className="mt-4">
                <SubmitButton className="btn-ghost w-full" confirm="Rouvrir le dossier d'accès ? L'apprenant devra à nouveau attendre votre validation.">Rouvrir le dossier</SubmitButton>
              </form>
            )}
          </section>
          <section className="card p-6 text-sm text-slate-600">
            <h2 className="mb-2 text-base">Rappel</h2>
            <p>Seuls les documents validés comptent. Un document refusé est signalé à l&apos;apprenant avec votre motif ; il peut en déposer un nouveau ou signer à nouveau.</p>
          </section>
        </aside>
      </div>
    </Container>
  );
}
