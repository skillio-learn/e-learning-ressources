import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { canManageOrg } from "@/lib/permissions";
import { STAFF_TRANSITIONS, missingProfileFields, requiredDocumentsFor } from "@/lib/applications";
import { APPLICATION_STATUS, DOCUMENT_TYPES, EMPLOYMENT_STATUS, FUNDING_TYPES } from "@/lib/labels";
import {
  enrollFromApplicationAction,
  reviewDocumentAction,
  sendApplicationMessageAction,
  setApplicationStatusAction,
} from "@/app/actions/applications";
import { Badge, Container } from "@/components/ui";
import { StateForm } from "@/components/StateForm";
import { StatusBadge } from "@/components/applications/StatusBadge";
import { Timeline } from "@/components/applications/Timeline";
import { MessageForm } from "@/components/applications/MessageForm";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Instruction du dossier" };

export default async function OfApplication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireOfManager();
  const app = await db.application.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, createdAt: true, profile: true } },
      course: {
        select: {
          id: true, title: true, durationHours: true, organizationId: true, requiredDocuments: true,
          organization: { select: { requiredDocuments: true, name: true } },
          sessions: { orderBy: { startDate: "asc" }, include: { _count: { select: { enrollments: true } } } },
        },
      },
      session: true,
      documents: {
        orderBy: { uploadedAt: "desc" },
        select: { id: true, type: true, fileName: true, fileType: true, size: true, status: true, comment: true, uploadedAt: true, reviewedAt: true, reviewedBy: { select: { name: true } } },
      },
      events: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: true } } } },
      reviewedBy: { select: { name: true } },
      enrollment: { select: { id: true } },
    },
  });
  if (!app || !canManageOrg(user, app.course.organizationId)) notFound();
  if (app.status === "SUBMITTED") {
    // Première ouverture par l'OF : passage automatique « en cours d'instruction »
    await db.application.update({
      where: { id },
      data: {
        status: "UNDER_REVIEW",
        reviewedById: user.id,
        events: { create: { type: "STATUS", fromStatus: "SUBMITTED", toStatus: "UNDER_REVIEW", authorId: user.id, message: "Dossier pris en charge par l'organisme" } },
      },
    });
    app.status = "UNDER_REVIEW";
  }
  const p = app.user.profile;
  const required = requiredDocumentsFor(app.course, app.fundingType);
  const missingFields = missingProfileFields(p, app.fundingType);
  const missingDocs = required.filter((c) => !app.documents.some((d) => d.type === c && d.status !== "REJECTED"));
  const pendingDocs = app.documents.filter((d) => d.status === "PENDING").length;
  const transitions = STAFF_TRANSITIONS[app.status];
  const defaultSession = app.session ?? app.course.sessions.find((s) => s.endDate >= new Date()) ?? null;
  const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="grid grid-cols-[160px_1fr] gap-2 border-b border-slate-50 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value || <span className="text-slate-300">—</span>}</span>
    </div>
  );

  return (
    <Container className="max-w-[1400px]">
      <Link href="/of/applications" className="text-sm text-slate-500 hover:text-brand-600">← Dossiers</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs text-slate-500">{app.number}</div>
          <h1>{app.user.name}</h1>
          <div className="text-sm text-slate-500">
            {app.user.email} · {app.course.title} · déposé le {formatDate(app.submittedAt, true)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={app.status} />
          <Link href={`/of/learners/${app.user.id}`} className="link text-sm">Voir la fiche apprenant</Link>
        </div>
      </div>

      {/* Contrôle automatique */}
      <div className="my-6 grid gap-3 md:grid-cols-3">
        <div className={`rounded-xl p-4 text-sm ${missingFields.length ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
          <b>Profil administratif</b>
          <div>{missingFields.length ? `Manquant : ${missingFields.join(", ")}` : "✓ Complet"}</div>
        </div>
        <div className={`rounded-xl p-4 text-sm ${missingDocs.length ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
          <b>Justificatifs obligatoires</b>
          <div>{missingDocs.length ? `Manquant : ${missingDocs.map((c) => DOCUMENT_TYPES[c].label).join(", ")}` : "✓ Tous fournis"}</div>
        </div>
        <div className={`rounded-xl p-4 text-sm ${pendingDocs ? "bg-blue-50 text-blue-900" : "bg-emerald-50 text-emerald-900"}`}>
          <b>Vérification des pièces</b>
          <div>{pendingDocs ? `${pendingDocs} pièce(s) à vérifier` : "✓ Toutes les pièces sont vérifiées"}</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3">Justificatifs</h2>
            <ul className="space-y-3">
              {required
                .filter((c) => !app.documents.some((d) => d.type === c))
                .map((c) => (
                  <li key={c} className="flex items-center justify-between rounded-lg border border-dashed border-red-200 p-3 text-sm">
                    <span>{DOCUMENT_TYPES[c].label}</span>
                    <Badge tone="red">Non fourni</Badge>
                  </li>
                ))}
              {app.documents.map((d) => (
                <li key={d.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {DOCUMENT_TYPES[d.type]?.label ?? d.type} {required.includes(d.type) && <span className="text-xs text-red-500">(obligatoire)</span>}
                      </div>
                      <div className="text-xs text-slate-500">
                        <a href={`/api/documents/${d.id}?inline=1`} target="_blank" className="text-brand-600 underline">{d.fileName}</a> ·{" "}
                        {Math.round(d.size / 1024)} Ko · déposé le {formatDate(d.uploadedAt, true)}
                        {d.reviewedAt && ` · vérifié par ${d.reviewedBy?.name ?? "—"} le ${formatDate(d.reviewedAt, true)}`}
                      </div>
                    </div>
                    {d.status === "VALIDATED" ? <Badge tone="green">✓ Validé</Badge> : d.status === "REJECTED" ? <Badge tone="red">✕ Refusé</Badge> : <Badge tone="blue">À vérifier</Badge>}
                  </div>
                  {d.comment && <div className="mt-1 text-xs text-red-700">Motif : {d.comment}</div>}
                  {d.fileType.startsWith("image/") && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/documents/${d.id}?inline=1`} alt="" className="mt-2 max-h-48 rounded border" />
                  )}
                  <StateForm action={reviewDocumentAction.bind(null, d.id)} submitLabel="Enregistrer" submitClassName="btn-secondary btn-sm" className="mt-2 flex flex-wrap items-center gap-2">
                    <select name="status" defaultValue={d.status === "PENDING" ? "VALIDATED" : d.status} className="input w-auto py-1 text-sm">
                      <option value="VALIDATED">✓ Valider</option>
                      <option value="REJECTED">✕ Refuser</option>
                      <option value="PENDING">Remettre en attente</option>
                    </select>
                    <input name="comment" placeholder="Motif (obligatoire si refus)" defaultValue={d.comment ?? ""} className="input min-w-[200px] flex-1 py-1 text-sm" />
                  </StateForm>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="mb-3">Profil administratif</h2>
            <div className="grid gap-x-8 md:grid-cols-2">
              <div>
                <Row label="Civilité" value={p?.civility} />
                <Row label="Nom" value={p?.lastName} />
                <Row label="Nom de naissance" value={p?.birthName} />
                <Row label="Prénom" value={p?.firstName} />
                <Row label="Né(e) le" value={p?.birthDate ? `${formatDate(p.birthDate)} à ${p.birthPlace ?? "—"}` : null} />
                <Row label="Nationalité" value={p?.nationality} />
                <Row label="Téléphone" value={p?.phone} />
                <Row label="Adresse" value={p?.address ? `${p.address}, ${p.postalCode ?? ""} ${p.city ?? ""} ${p.country ?? ""}` : null} />
              </div>
              <div>
                <Row label="Situation" value={p?.employmentStatus ? EMPLOYMENT_STATUS[p.employmentStatus] : null} />
                <Row label="Id. France Travail" value={p?.franceTravailId} />
                <Row label="Agence FT" value={p?.franceTravailAgency} />
                <Row label="Niveau" value={p?.educationLevel} />
                <Row label="Dernier diplôme" value={p?.lastDiploma} />
                <Row label="Emploi" value={p?.currentJob} />
                <Row label="Employeur" value={p?.employerName ? `${p.employerName} (SIRET ${p.employerSiret ?? "—"})` : null} />
                <Row label="OPCO" value={p?.opcoName} />
                <Row label="Contact employeur" value={[p?.employerContactName, p?.employerContactEmail, p?.employerContactPhone].filter(Boolean).join(" · ")} />
                <Row label="Handicap / RQTH" value={p?.disability ? `Oui — ${p.disabilityNeeds ?? ""}` : "Non"} />
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-3">Projet & financement</h2>
            <Row label="Financement" value={app.fundingType ? FUNDING_TYPES[app.fundingType] : null} />
            <Row label="Référence" value={app.fundingReference} />
            <Row label="Précisions" value={app.fundingDetails} />
            <Row label="Session souhaitée" value={app.session ? `${app.session.name} (${formatDate(app.session.startDate)} → ${formatDate(app.session.endDate)})` : null} />
            <Row label="Disponibilités" value={app.availability} />
            <Row label="Prérequis" value={app.prerequisitesOk ? "✓ Attestés par l'apprenant" : "Non attestés"} />
            <Row label="Consentements" value={app.consentAt ? `RGPD + CGV/règlement acceptés le ${formatDate(app.consentAt, true)}` : "—"} />
            <div className="mt-3 space-y-3 text-sm">
              <div><div className="text-slate-500">Motivation</div><p className="whitespace-pre-wrap">{app.motivation || "—"}</p></div>
              <div><div className="text-slate-500">Attentes</div><p className="whitespace-pre-wrap">{app.expectations || "—"}</p></div>
              <div><div className="text-slate-500">Expérience / positionnement</div><p className="whitespace-pre-wrap">{app.experience || "—"}</p></div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          {transitions.length > 0 && (
            <section className="card border-brand-200 p-5 ring-2 ring-brand-100">
              <h2 className="mb-3">Décision</h2>
              <StateForm action={setApplicationStatusAction.bind(null, app.id)} submitLabel="Appliquer">
                <select name="status" className="input" defaultValue={transitions.includes("ACCEPTED") ? "ACCEPTED" : transitions[0]}>
                  {transitions.map((t) => <option key={t} value={t}>{APPLICATION_STATUS[t].label}</option>)}
                </select>
                <textarea name="message" rows={3} className="input" placeholder="Message à l'apprenant (obligatoire pour une demande de compléments ou un refus)" />
                {transitions.includes("ACCEPTED") && pendingDocs + app.documents.filter((d) => d.status === "REJECTED").length > 0 && (
                  <label className="flex items-center gap-2 text-xs text-amber-800">
                    <input type="checkbox" name="force" /> Valider malgré des pièces non validées
                  </label>
                )}
              </StateForm>
            </section>
          )}

          {app.status === "ACCEPTED" && (
            <section className="card border-emerald-300 p-5 ring-2 ring-emerald-100">
              <h2 className="mb-1">Inscription définitive</h2>
              <p className="mb-3 text-xs text-slate-500">Crée l&apos;accès à la formation et fixe les éléments du certificat de réalisation.</p>
              <StateForm action={enrollFromApplicationAction.bind(null, app.id)} submitLabel="Inscrire définitivement" submitClassName="btn-primary w-full">
                {app.course.sessions.length > 0 && (
                  <label className="block text-sm">
                    <span className="label">Session</span>
                    <select name="sessionId" defaultValue={defaultSession?.id ?? ""} className="input">
                      <option value="">— Sans session —</option>
                      {app.course.sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({formatDate(s.startDate)} → {formatDate(s.endDate)}) {s.capacity ? `· ${s._count.enrollments}/${s.capacity}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-sm"><span className="label">Début</span><input type="date" name="startDate" required defaultValue={iso(defaultSession?.startDate ?? new Date())} className="input" /></label>
                  <label className="block text-sm"><span className="label">Fin</span><input type="date" name="endDate" required defaultValue={iso(defaultSession?.endDate)} className="input" /></label>
                </div>
                <label className="block text-sm"><span className="label">Durée prévue (heures)</span><input type="number" step="0.5" min="0.5" name="plannedHours" required defaultValue={app.course.durationHours ?? ""} className="input" /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-sm">
                    <span className="label">Financement</span>
                    <select name="fundingType" defaultValue={app.fundingType ?? ""} className="input">
                      {Object.entries(FUNDING_TYPES).map(([v, l]) => <option key={v} value={v}>{l.split(" (")[0]}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm"><span className="label">N° de prise en charge</span><input name="fundingReference" defaultValue={app.fundingReference ?? ""} className="input" /></label>
                </div>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="overbook" /> Dépasser la capacité de la session si besoin</label>
              </StateForm>
            </section>
          )}

          {app.enrollment && (
            <Link href={`/of/learners/${app.user.id}`} className="card block p-4 text-sm text-emerald-800 hover:shadow">
              Inscrit(e) définitivement — voir le suivi de formation
            </Link>
          )}

          <section className="card p-5">
            <h2 className="mb-3">Historique & échanges</h2>
            <Timeline events={app.events} learnerId={app.userId} showInternal />
            <div className="mt-4">
              <MessageForm action={sendApplicationMessageAction.bind(null, app.id)} staff />
            </div>
          </section>
        </aside>
      </div>
    </Container>
  );
}
