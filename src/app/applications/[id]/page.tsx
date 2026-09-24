import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EDITABLE_STATUSES, applicationBlockers, requiredDocumentsFor } from "@/lib/applications";
import { toProfileData } from "@/lib/profile";
import { APPLICATION_STATUS, DOCUMENT_TYPES, FUNDING_TYPES } from "@/lib/labels";
import {
  deleteDocumentAction,
  saveApplicationDetailsAction,
  saveProfileAction,
  sendApplicationMessageAction,
  submitApplicationAction,
  uploadDocumentAction,
  withdrawApplicationAction,
} from "@/app/actions/applications";
import { Badge, Container } from "@/components/ui";
import { ProfileForm } from "@/components/applications/ProfileForm";
import { DetailsForm } from "@/components/applications/DetailsForm";
import { DocumentUpload } from "@/components/applications/DocumentUpload";
import { Timeline } from "@/components/applications/Timeline";
import { MessageForm } from "@/components/applications/MessageForm";
import { StatusBadge } from "@/components/applications/StatusBadge";
import { StateForm } from "@/components/StateForm";
import { SubmitButton } from "@/components/SubmitButton";
import { cn, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon dossier" };

const STEPS = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "ENROLLED"] as const;

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const app = await db.application.findUnique({
    where: { id },
    include: {
      course: {
        select: {
          id: true, title: true, slug: true, prerequisites: true, requiredDocuments: true,
          organization: { select: { name: true, requiredDocuments: true, internalRulesUrl: true, cgvUrl: true, email: true, phone: true } },
          sessions: { where: { open: true, endDate: { gte: new Date() } }, orderBy: { startDate: "asc" }, include: { _count: { select: { enrollments: true } } } },
        },
      },
      documents: { orderBy: { uploadedAt: "desc" }, select: { id: true, type: true, fileName: true, size: true, status: true, comment: true, uploadedAt: true } },
      events: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: true } } } },
      session: true,
    },
  });
  if (!app || app.userId !== user.id) notFound();

  const profile = await db.learnerProfile.findUnique({ where: { userId: user.id } });
  const editable = EDITABLE_STATUSES.includes(app.status);
  const required = requiredDocumentsFor(app.course, app.fundingType);
  const { blockers } = editable ? await applicationBlockers(app.id) : { blockers: [] as string[] };
  const optionalTypes = Object.entries(DOCUMENT_TYPES)
    .filter(([code]) => !required.includes(code))
    .map(([code, d]) => ({ code, label: d.label }));
  const stepIndex = app.status === "INCOMPLETE" ? 2 : STEPS.indexOf(app.status as (typeof STEPS)[number]);
  const org = app.course.organization;

  return (
    <Container className="max-w-6xl">
      <Link href="/applications" className="text-sm text-slate-500 hover:text-brand-600">← Mes dossiers</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400">Dossier {app.number} · {org.name}</div>
          <h1>{app.course.title}</h1>
        </div>
        <StatusBadge status={app.status} />
      </div>

      {/* Frise d'avancement */}
      {!["REJECTED", "WITHDRAWN"].includes(app.status) && (
        <ol className="my-6 grid grid-cols-5 gap-2 text-center text-xs">
          {["Constitution", "Dépôt", "Vérification", "Validation", "Inscription"].map((label, i) => (
            <li key={label}>
              <div className={cn("mx-auto mb-1 h-2 rounded-full", i <= stepIndex ? "bg-brand-600" : "bg-slate-200")} />
              <span className={i <= stepIndex ? "font-medium text-brand-700" : "text-slate-400"}>{label}</span>
            </li>
          ))}
        </ol>
      )}

      {app.status === "INCOMPLETE" && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <b>L&apos;organisme vous demande des compléments.</b> Consultez les messages ci-dessous, mettez à jour votre dossier puis
          redéposez-le.
        </div>
      )}
      {app.status === "REJECTED" && app.decisionReason && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <b>Motif :</b> {app.decisionReason}
        </div>
      )}
      {app.status === "ENROLLED" && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <span>🎉 Vous êtes inscrit(e) définitivement à cette formation.</span>
          <Link href={`/learn/${app.course.slug}`} className="btn-primary ml-auto">Accéder à la formation</Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-1">1. Mon profil administratif</h2>
            <p className="mb-4 text-sm text-slate-500">Informations exigées par les financeurs (OPCO, France Travail, Caisse des dépôts).</p>
            <ProfileForm action={saveProfileAction.bind(null, app.id)} profile={toProfileData(profile)} disabled={!editable} />
          </section>

          <section className="card p-6">
            <h2 className="mb-4">2. Mon projet & financement</h2>
            <DetailsForm
              action={saveApplicationDetailsAction.bind(null, app.id)}
              disabled={!editable}
              prerequisites={app.course.prerequisites}
              sessions={app.course.sessions.map((s) => ({
                id: s.id,
                label: `${s.name} — du ${formatDate(s.startDate)} au ${formatDate(s.endDate)}${s.location ? ` (${s.location})` : ""}`,
                full: !!s.capacity && s._count.enrollments >= s.capacity,
              }))}
              app={app}
            />
          </section>

          <section className="card p-6">
            <h2 className="mb-1">3. Mes justificatifs</h2>
            <p className="mb-4 text-sm text-slate-500">PDF, JPG, PNG ou Word — 10 Mo maximum par fichier. Les pièces exigées dépendent de la formation et de votre financement.</p>
            <ul className="space-y-3">
              {required.map((code) => {
                const docs = app.documents.filter((d) => d.type === code);
                const current = docs[0];
                return (
                  <li key={code} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{DOCUMENT_TYPES[code].label} <span className="text-red-500">*</span></div>
                        {DOCUMENT_TYPES[code].hint && <div className="text-xs text-slate-500">{DOCUMENT_TYPES[code].hint}</div>}
                      </div>
                      {current ? <DocStatus status={current.status} /> : <Badge tone="red">Manquant</Badge>}
                    </div>
                    {current && (
                      <DocLine doc={current} canDelete={editable && current.status !== "VALIDATED"} />
                    )}
                    {editable && current?.status !== "VALIDATED" && (
                      <div className="mt-2">
                        <DocumentUpload action={uploadDocumentAction.bind(null, app.id)} type={code} label={current ? "Remplacer" : "Déposer"} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {app.documents.filter((d) => !required.includes(d.type)).length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-sm font-medium">Autres pièces</div>
                <ul className="space-y-2">
                  {app.documents
                    .filter((d) => !required.includes(d.type))
                    .map((d) => (
                      <li key={d.id} className="rounded-lg border border-slate-100 p-3">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium">{DOCUMENT_TYPES[d.type]?.label ?? d.type}</span>
                          <DocStatus status={d.status} />
                        </div>
                        <DocLine doc={d} canDelete={editable && d.status !== "VALIDATED"} />
                      </li>
                    ))}
                </ul>
              </div>
            )}
            {editable && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <div className="mb-2 text-sm font-medium">Ajouter une pièce complémentaire</div>
                <DocumentUpload action={uploadDocumentAction.bind(null, app.id)} optionalTypes={optionalTypes} label="Ajouter" />
              </div>
            )}
          </section>

          {editable && (
            <section className="card border-brand-200 p-6 ring-2 ring-brand-100">
              <h2 className="mb-3">4. Dépôt du dossier</h2>
              {blockers.length > 0 ? (
                <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-medium">Avant de déposer, complétez :</div>
                  <ul className="mt-1 list-disc pl-5">
                    {blockers.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                </div>
              ) : (
                <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">✅ Votre dossier est complet, vous pouvez le déposer.</p>
              )}
              <StateForm action={submitApplicationAction.bind(null, app.id)} submitLabel={app.status === "INCOMPLETE" ? "Renvoyer mon dossier complété" : "Déposer mon dossier"}>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="certify" className="mt-1 accent-brand-600" />
                  Je certifie l&apos;exactitude des informations fournies et l&apos;authenticité des justificatifs.
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="consentTerms" className="mt-1 accent-brand-600" />
                  <span>
                    J&apos;ai pris connaissance des{" "}
                    {org.cgvUrl ? <a href={org.cgvUrl} target="_blank" className="text-brand-600 underline">conditions générales de vente</a> : "conditions générales de vente"} et du{" "}
                    {org.internalRulesUrl ? <a href={org.internalRulesUrl} target="_blank" className="text-brand-600 underline">règlement intérieur</a> : "règlement intérieur"} de l&apos;organisme.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="consentRgpd" className="mt-1 accent-brand-600" />
                  <span>
                    J&apos;accepte que mes données soient traitées par {org.name} pour l&apos;instruction de mon dossier, le suivi de ma formation
                    et les déclarations obligatoires auprès des financeurs (<a href="/legal/confidentialite" target="_blank" className="text-brand-600 underline">politique de confidentialité</a>).
                  </span>
                </label>
              </StateForm>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card space-y-2 p-4 text-sm">
            <div className="text-xs font-semibold uppercase text-slate-400">Récapitulatif</div>
            <div><span className="text-slate-500">Statut :</span> {APPLICATION_STATUS[app.status].label}</div>
            <div><span className="text-slate-500">Financement :</span> {app.fundingType ? FUNDING_TYPES[app.fundingType] : "—"}</div>
            {app.session && <div><span className="text-slate-500">Session :</span> {app.session.name}</div>}
            <div><span className="text-slate-500">Créé le :</span> {formatDate(app.createdAt)}</div>
            {app.submittedAt && <div><span className="text-slate-500">Déposé le :</span> {formatDate(app.submittedAt, true)}</div>}
            {(org.email || org.phone) && (
              <div className="border-t border-slate-100 pt-2 text-xs text-slate-500">
                Contact OF : {org.email} {org.phone}
              </div>
            )}
          </div>
          <div className="card p-4">
            <h2 className="mb-3 text-base">Échanges avec l&apos;organisme</h2>
            <Timeline events={app.events} learnerId={app.userId} showInternal={false} />
            {!["WITHDRAWN"].includes(app.status) && (
              <div className="mt-4">
                <MessageForm action={sendApplicationMessageAction.bind(null, app.id)} />
              </div>
            )}
          </div>
          {!["ENROLLED", "REJECTED", "WITHDRAWN"].includes(app.status) && (
            <form action={withdrawApplicationAction.bind(null, app.id)} className="card p-4">
              <SubmitButton className="btn-ghost w-full text-red-600" confirm="Retirer définitivement votre candidature ?">
                Retirer ma candidature
              </SubmitButton>
            </form>
          )}
        </aside>
      </div>
    </Container>
  );
}

function DocStatus({ status }: { status: "PENDING" | "VALIDATED" | "REJECTED" }) {
  if (status === "VALIDATED") return <Badge tone="green">✓ Validé</Badge>;
  if (status === "REJECTED") return <Badge tone="red">✕ Refusé</Badge>;
  return <Badge tone="blue">En attente de vérification</Badge>;
}

function DocLine({
  doc,
  canDelete,
}: {
  doc: { id: string; fileName: string; size: number; status: string; comment: string | null; uploadedAt: Date };
  canDelete: boolean;
}) {
  return (
    <div className="mt-2 space-y-1 text-xs">
      <div className="flex flex-wrap items-center gap-2 text-slate-600">
        <a href={`/api/documents/${doc.id}?inline=1`} target="_blank" className="text-brand-600 underline">{doc.fileName}</a>
        <span>{Math.round(doc.size / 1024)} Ko · {formatDate(doc.uploadedAt, true)}</span>
        {canDelete && (
          <form action={deleteDocumentAction.bind(null, doc.id)} className="inline">
            <button className="text-red-600 hover:underline">Supprimer</button>
          </form>
        )}
      </div>
      {doc.status === "REJECTED" && doc.comment && <div className="rounded bg-red-50 px-2 py-1 text-red-700">Motif : {doc.comment}</div>}
    </div>
  );
}
