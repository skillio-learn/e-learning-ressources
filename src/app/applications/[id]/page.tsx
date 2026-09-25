import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EDITABLE_STATUSES, applicationBlockers, missingProfileFields, requiredDocumentsFor } from "@/lib/applications";
import { toProfileData } from "@/lib/profile";
import { APPLICATION_STATUS, DOCUMENT_TYPES, FUNDING_TYPES, SKILL_LEVELS, learnerProfileEditable } from "@/lib/labels";
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

const PROGRESS = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "ENROLLED"] as const;
const STEP_LABELS = ["Mes informations", "Projet & financement", "Justificatifs", "Vérification & dépôt"];

export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const { id } = await params;
  const { step: stepParam } = await searchParams;
  const user = await requireUser();
  const app = await db.application.findUnique({
    where: { id },
    include: {
      course: {
        select: {
          id: true, title: true, slug: true, prerequisites: true, requiredDocuments: true, skills: true,
          organization: { select: { name: true, requiredDocuments: true, internalRulesUrl: true, cgvUrl: true, email: true, phone: true } },
          sessions: { where: { open: true, endDate: { gte: new Date() } }, orderBy: { startDate: "asc" }, include: { _count: { select: { enrollments: true } } } },
        },
      },
      documents: { orderBy: { uploadedAt: "asc" }, select: { id: true, type: true, fileName: true, size: true, status: true, comment: true, uploadedAt: true } },
      events: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: true } } } },
      session: true,
      enrollment: { select: { id: true, conventionSignedAt: true, accessStatus: true } },
    },
  });
  if (!app || app.userId !== user.id) notFound();

  const profile = await db.learnerProfile.findUnique({ where: { userId: user.id } });
  const editable = EDITABLE_STATUSES.includes(app.status);
  const required = requiredDocumentsFor(app.course, app.fundingType);
  const { blockers } = editable ? await applicationBlockers(app.id) : { blockers: [] as string[] };
  const org = app.course.organization;
  const positioning = (app.positioning ?? {}) as Record<string, number>;

  // Complétude de chaque étape
  const done = [
    missingProfileFields(profile, app.fundingType).length === 0,
    !!app.fundingType && (app.motivation?.trim().length ?? 0) >= 30 && app.prerequisitesOk &&
      (app.course.sessions.length === 0 || !!app.sessionId) && app.course.skills.every((s) => positioning[s] !== undefined),
    required.every((c) => app.documents.some((d) => d.type === c && d.status !== "REJECTED")),
    blockers.length === 0,
  ];
  const firstTodo = done.findIndex((d) => !d);
  const step = Math.min(4, Math.max(1, Number(stepParam) || (firstTodo === -1 ? 4 : firstTodo + 1)));
  const href = (n: number) => `/applications/${app.id}?step=${n}`;
  const progressIndex = app.status === "INCOMPLETE" ? 2 : PROGRESS.indexOf(app.status as (typeof PROGRESS)[number]);
  const optionalTypes = Object.entries(DOCUMENT_TYPES)
    .filter(([code]) => !required.includes(code))
    .map(([code, d]) => ({ code, label: d.label }));

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

      {!["REJECTED", "WITHDRAWN"].includes(app.status) && (
        <ol className="my-6 grid grid-cols-5 gap-2 text-center text-xs">
          {["Constitution", "Dépôt", "Vérification", "Validation", "Inscription"].map((label, i) => (
            <li key={label}>
              <div className={cn("mx-auto mb-1 h-2 rounded-full", i <= progressIndex ? "bg-brand-600" : "bg-slate-200")} />
              <span className={i <= progressIndex ? "font-medium text-brand-700" : "text-slate-400"}>{label}</span>
            </li>
          ))}
        </ol>
      )}

      {app.status === "INCOMPLETE" && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <b>L&apos;organisme vous demande des compléments.</b> Lisez le message dans « Échanges », corrigez votre dossier puis renvoyez-le à l&apos;étape 4.
        </div>
      )}
      {app.status === "REJECTED" && app.decisionReason && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><b>Motif :</b> {app.decisionReason}</div>
      )}
      {app.status === "ENROLLED" && app.enrollment && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {app.enrollment.accessStatus === "GRANTED" ? (
            <>
              <span>Vous êtes inscrit(e) définitivement et votre accès est ouvert.</span>
              <Link href={`/learn/${app.course.slug}`} className="btn-primary ml-auto">Accéder à la formation</Link>
            </>
          ) : (
            <>
              <span>Candidature acceptée. Dernière étape : signez votre convention et vos documents d&apos;inscription pour que l&apos;organisme ouvre votre accès.</span>
              <Link href={`/enrollments/${app.enrollment.id}`} className="btn-primary ml-auto">Finaliser mon inscription</Link>
            </>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          {editable ? (
            <>
              {/* Assistant : une étape à la fois, rien ne se perd */}
              <nav className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                {STEP_LABELS.map((label, i) => (
                  <Link
                    key={label}
                    href={href(i + 1)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      step === i + 1 ? "border-brand-500 bg-brand-50 font-semibold text-brand-800" : "border-slate-200 bg-surface hover:bg-slate-50",
                    )}
                  >
                    <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold", done[i] ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600")}>
                      {done[i] ? "✓" : i + 1}
                    </span>
                    {label}
                  </Link>
                ))}
              </nav>

              {step === 1 && (
                <section className="card p-6">
                  <h2 className="mb-1">1. Mes informations administratives</h2>
                  <p className="mb-4 text-sm text-slate-500">Informations exigées par les financeurs (OPCO, France Travail, Caisse des dépôts). Elles sont conservées pour vos prochains dossiers.</p>
                  {learnerProfileEditable(user.accountStatus) ? (
                    <ProfileForm action={saveProfileAction.bind(null, app.id)} profile={toProfileData(profile)} nextHref={href(2)} submitLabel="Enregistrer et continuer →" />
                  ) : (
                    <>
                      <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        Informations vérifiées par votre organisme. Une erreur ? <Link href="/profile" className="link">Demandez une modification</Link>.
                      </p>
                      <ProfileForm action={saveProfileAction.bind(null, app.id)} profile={toProfileData(profile)} disabled />
                      <Link href={href(2)} className="btn-primary mt-4">Continuer</Link>
                    </>
                  )}
                </section>
              )}

              {step === 2 && (
                <section className="card p-6">
                  <h2 className="mb-4">2. Mon projet, mon financement et mon positionnement</h2>
                  <DetailsForm
                    action={saveApplicationDetailsAction.bind(null, app.id)}
                    prerequisites={app.course.prerequisites}
                    skills={app.course.skills}
                    positioning={positioning}
                    nextHref={href(3)}
                    sessions={app.course.sessions.map((s) => ({
                      id: s.id,
                      label: `${s.name} — du ${formatDate(s.startDate)} au ${formatDate(s.endDate)}${s.location ? ` (${s.location})` : ""}`,
                      full: !!s.capacity && s._count.enrollments >= s.capacity,
                    }))}
                    app={app}
                  />
                </section>
              )}

              {step === 3 && (
                <section className="card p-6">
                  <h2 className="mb-1">3. Mes justificatifs</h2>
                  <p className="mb-4 text-sm text-slate-500">
                    PDF, photo ou Word — 10 Mo maximum par fichier, jusqu&apos;à 5 fichiers par pièce (ex. recto et verso). Les pièces exigées dépendent de votre financement.
                  </p>
                  <ul className="space-y-3">
                    {required.map((code) => {
                      const docs = app.documents.filter((d) => d.type === code);
                      const ok = docs.some((d) => d.status !== "REJECTED");
                      const validated = docs.length > 0 && docs.every((d) => d.status === "VALIDATED");
                      return (
                        <li key={code} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="font-medium">{DOCUMENT_TYPES[code].label} <span className="text-red-500">*</span></div>
                              {DOCUMENT_TYPES[code].hint && <div className="text-xs text-slate-500">{DOCUMENT_TYPES[code].hint}</div>}
                            </div>
                            {validated ? <Badge tone="green">✓ Validé</Badge> : ok ? <Badge tone="blue">Fourni</Badge> : <Badge tone="red">Manquant</Badge>}
                          </div>
                          {docs.map((d) => <DocLine key={d.id} doc={d} canDelete={d.status !== "VALIDATED"} />)}
                          {!validated && (
                            <div className="mt-2">
                              <DocumentUpload action={uploadDocumentAction.bind(null, app.id)} type={code} label={docs.length ? "Ajouter un fichier" : "Déposer"} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {app.documents.some((d) => !required.includes(d.type)) && (
                    <div className="mt-4 space-y-2">
                      <div className="text-sm font-medium">Autres pièces</div>
                      {app.documents.filter((d) => !required.includes(d.type)).map((d) => (
                        <div key={d.id} className="rounded-lg border border-slate-100 p-2 text-sm">
                          <span className="font-medium">{DOCUMENT_TYPES[d.type]?.label ?? d.type}</span>
                          <DocLine doc={d} canDelete={d.status !== "VALIDATED"} />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 rounded-lg bg-slate-50 p-3">
                    <div className="mb-2 text-sm font-medium">Ajouter une pièce complémentaire (facultatif)</div>
                    <DocumentUpload action={uploadDocumentAction.bind(null, app.id)} optionalTypes={optionalTypes} label="Ajouter" />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Link href={href(4)} className="btn-primary">Continuer vers la vérification →</Link>
                  </div>
                </section>
              )}

              {step === 4 && (
                <section className="card p-6">
                  <h2 className="mb-3">4. Vérification & dépôt</h2>
                  {blockers.length > 0 ? (
                    <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                      <div className="font-medium">Il reste à compléter :</div>
                      <ul className="mt-1 list-disc pl-5">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                    </div>
                  ) : (
                    <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Votre dossier est complet.</p>
                  )}
                  <dl className="mb-4 grid gap-1 text-sm md:grid-cols-2">
                    <div><span className="text-slate-500">Identité :</span> {profile?.civility} {profile?.firstName} {profile?.lastName}</div>
                    <div><span className="text-slate-500">Financement :</span> {app.fundingType ? FUNDING_TYPES[app.fundingType] : "—"}</div>
                    <div><span className="text-slate-500">Session :</span> {app.session?.name ?? "—"}</div>
                    <div><span className="text-slate-500">Justificatifs :</span> {app.documents.filter((d) => d.status !== "REJECTED").length} fichier(s)</div>
                  </dl>
                  <StateForm action={submitApplicationAction.bind(null, app.id)} submitLabel={app.status === "INCOMPLETE" ? "Renvoyer mon dossier complété" : "Déposer mon dossier"}>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="certify" className="mt-1 accent-brand-600" />
                      Je certifie l&apos;exactitude des informations fournies et l&apos;authenticité des justificatifs.
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="consentTerms" className="mt-1 accent-brand-600" />
                      <span>
                        J&apos;ai pris connaissance des {org.cgvUrl ? <a href={org.cgvUrl} target="_blank" className="text-brand-600 underline">conditions générales de vente</a> : "conditions générales de vente"} et du{" "}
                        {org.internalRulesUrl ? <a href={org.internalRulesUrl} target="_blank" className="text-brand-600 underline">règlement intérieur</a> : "règlement intérieur"}.
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="consentRgpd" className="mt-1 accent-brand-600" />
                      <span>
                        J&apos;accepte que mes données soient traitées par {org.name} pour l&apos;instruction de mon dossier, le suivi de ma formation et les
                        déclarations aux financeurs (<a href="/legal/confidentialite" target="_blank" className="text-brand-600 underline">politique de confidentialité</a>).
                      </span>
                    </label>
                  </StateForm>
                </section>
              )}
            </>
          ) : (
            <section className="card space-y-4 p-6 text-sm">
              <h2>Mon dossier déposé</h2>
              <dl className="grid gap-1 md:grid-cols-2">
                <div><span className="text-slate-500">Identité :</span> {profile?.civility} {profile?.firstName} {profile?.lastName}</div>
                <div><span className="text-slate-500">Financement :</span> {app.fundingType ? FUNDING_TYPES[app.fundingType] : "—"} {app.fundingReference ?? ""}</div>
                <div><span className="text-slate-500">Session :</span> {app.session?.name ?? "—"}</div>
                <div><span className="text-slate-500">Déposé le :</span> {formatDate(app.submittedAt, true)}</div>
              </dl>
              {app.course.skills.length > 0 && (
                <div>
                  <div className="mb-1 font-medium">Mon positionnement d&apos;entrée</div>
                  <ul className="grid gap-1 md:grid-cols-2">
                    {app.course.skills.map((s) => <li key={s}>{s} : <b>{positioning[s] !== undefined ? SKILL_LEVELS[positioning[s]] : "—"}</b></li>)}
                  </ul>
                </div>
              )}
              <div>
                <div className="mb-1 font-medium">Justificatifs</div>
                {app.documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 border-b border-slate-50 py-1">
                    <span>{DOCUMENT_TYPES[d.type]?.label ?? d.type} — <a href={`/api/documents/${d.id}?inline=1`} target="_blank" className="text-brand-600 underline">{d.fileName}</a></span>
                    {d.status === "VALIDATED" ? <Badge tone="green">Validé</Badge> : d.status === "REJECTED" ? <Badge tone="red">Refusé</Badge> : <Badge tone="blue">En vérification</Badge>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card space-y-2 p-4 text-sm">
            <div className="text-xs font-semibold uppercase text-slate-400">Récapitulatif</div>
            <div><span className="text-slate-500">Statut :</span> {APPLICATION_STATUS[app.status].label}</div>
            <div><span className="text-slate-500">Créé le :</span> {formatDate(app.createdAt)}</div>
            {(org.email || org.phone) && <div className="border-t border-slate-100 pt-2 text-xs text-slate-500">Contact OF : {org.email} {org.phone}</div>}
          </div>
          <div className="card p-4">
            <h2 className="mb-3 text-base">Échanges avec l&apos;organisme</h2>
            <Timeline events={app.events} learnerId={app.userId} showInternal={false} />
            {app.status !== "WITHDRAWN" && <div className="mt-4"><MessageForm action={sendApplicationMessageAction.bind(null, app.id)} /></div>}
          </div>
          {!["ENROLLED", "REJECTED", "WITHDRAWN"].includes(app.status) && (
            <form action={withdrawApplicationAction.bind(null, app.id)} className="card p-4">
              <SubmitButton className="btn-ghost w-full text-red-600" confirm="Retirer définitivement votre candidature ?">Retirer ma candidature</SubmitButton>
            </form>
          )}
        </aside>
      </div>
    </Container>
  );
}

function DocLine({ doc, canDelete }: { doc: { id: string; fileName: string; size: number; status: string; comment: string | null; uploadedAt: Date }; canDelete: boolean }) {
  return (
    <div className="mt-2 space-y-1 text-xs">
      <div className="flex flex-wrap items-center gap-2 text-slate-600">
        <span className={`h-2 w-2 rounded-full ${doc.status === "VALIDATED" ? "bg-emerald-500" : doc.status === "REJECTED" ? "bg-red-500" : "bg-slate-400"}`} />
        <a href={`/api/documents/${doc.id}?inline=1`} target="_blank" className="text-brand-600 underline">{doc.fileName}</a>
        <span>{Math.max(1, Math.round(doc.size / 1024))} Ko · {formatDate(doc.uploadedAt, true)}</span>
        {canDelete && (
          <form action={deleteDocumentAction.bind(null, doc.id)} className="inline">
            <button className="text-red-600 hover:underline">Supprimer</button>
          </form>
        )}
      </div>
      {doc.status === "REJECTED" && doc.comment && <div className="rounded bg-red-50 px-2 py-1 text-red-700">Refusé : {doc.comment} — merci d&apos;ajouter un nouveau fichier.</div>}
    </div>
  );
}
