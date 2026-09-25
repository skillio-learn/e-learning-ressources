import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Clock3, FileSignature, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageOrg } from "@/lib/permissions";
import { accessChecklist } from "@/lib/onboarding";
import { ACCESS_STATUS, DOC_SOURCE } from "@/lib/labels";
import { deleteEnrollmentDocumentAction, uploadEnrollmentDocumentAction } from "@/app/actions/access";
import { DocumentUpload } from "@/components/applications/DocumentUpload";
import { Badge, Container, PageHeader } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Mon inscription" };
export const dynamic = "force-dynamic";

const STATE_BADGE = {
  VALIDATED: <Badge tone="green">Validé</Badge>,
  PENDING: <Badge tone="blue">En vérification</Badge>,
  REJECTED: <Badge tone="red">Refusé – à reprendre</Badge>,
  MISSING: <Badge tone="amber">À fournir</Badge>,
};

export default async function EnrollmentAccess({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const owner = await db.enrollment.findUnique({ where: { id }, select: { userId: true, course: { select: { organizationId: true } } } });
  if (!owner) notFound();
  if (owner.userId !== user.id) {
    if (canManageOrg(user, owner.course.organizationId)) redirect(`/of/access/${id}`);
    notFound();
  }
  const { enrollment: e, org, items, extraDocs } = await accessChecklist(id);
  const st = ACCESS_STATUS[e.accessStatus];
  const locked = e.accessStatus === "REFUSED" || e.accessStatus === "GRANTED";
  const refUrl = (type: string) => (type === "CGV" ? org.cgvUrl : type === "INTERNAL_RULES" ? org.internalRulesUrl : null);

  return (
    <Container className="max-w-4xl">
      <PageHeader
        back={{ href: "/learn", label: "Mes formations" }}
        title={e.course.title}
        subtitle={`Inscription auprès de ${org.name}`}
        actions={<Badge tone={st.tone}>{st.label}</Badge>}
      />

      {e.accessStatus === "GRANTED" && (
        <div className="card mb-6 flex flex-wrap items-center gap-4 border-emerald-200 bg-emerald-50 p-5">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" strokeWidth={1.75} />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-slate-900">Votre accès est ouvert</div>
            <div className="text-slate-600">Validé le {formatDate(e.accessDecidedAt, true)}{e.accessDecidedBy ? ` par ${e.accessDecidedBy.name}` : ""}.</div>
          </div>
          <Link href={`/learn/${e.course.slug}`} className="btn-primary">Commencer la formation</Link>
        </div>
      )}
      {e.accessStatus === "UNDER_REVIEW" && (
        <div className="card mb-6 flex items-start gap-4 border-brand-200 bg-brand-50 p-5 text-sm">
          <Clock3 className="mt-0.5 h-5 w-5 text-brand-600" strokeWidth={1.75} />
          <div>
            <div className="font-semibold text-slate-900">Documents transmis — l&apos;organisme les vérifie</div>
            <div className="text-slate-600">Vous serez notifié(e) dès l&apos;ouverture de votre accès.</div>
          </div>
        </div>
      )}
      {e.accessStatus === "REFUSED" && (
        <div className="card mb-6 flex items-start gap-4 border-red-200 bg-red-50 p-5 text-sm">
          <XCircle className="mt-0.5 h-5 w-5 text-red-600" strokeWidth={1.75} />
          <div>
            <div className="font-semibold text-slate-900">L&apos;accès à cette formation a été refusé</div>
            {e.accessDecisionNote && <p className="mt-1 whitespace-pre-line text-slate-700">Motif : {e.accessDecisionNote}</p>}
            <p className="mt-1 text-slate-600">Une question ? Utilisez le chat d&apos;assistance.</p>
          </div>
        </div>
      )}
      {e.accessRequestNote && e.accessStatus !== "GRANTED" && e.accessStatus !== "REFUSED" && (
        <div className="card mb-6 border-amber-200 bg-amber-50 p-5 text-sm">
          <div className="font-semibold text-slate-900">Compléments demandés par l&apos;organisme{e.accessRequestAt ? ` le ${formatDate(e.accessRequestAt, true)}` : ""}</div>
          <p className="mt-1 whitespace-pre-line text-slate-700">{e.accessRequestNote}</p>
        </div>
      )}
      {e.accessStatus === "PENDING_DOCUMENTS" && (
        <p className="mb-6 text-[15px] text-slate-600">
          Pour valider votre inscription, signez en ligne ou déposez les documents ci-dessous. L&apos;organisme les vérifie puis ouvre votre accès à la formation.
        </p>
      )}

      <section className="card p-6">
        <h2 className="mb-4">Documents d&apos;inscription</h2>
        {items.length === 0 && <p className="text-sm text-slate-500">Aucun document n&apos;est exigé par l&apos;organisme.</p>}
        <ul className="space-y-4">
          {items.map((it) => (
            <li key={it.type} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-900">{it.label}</div>
                  <div className="text-xs text-slate-500">{it.hint}</div>
                </div>
                {STATE_BADGE[it.state]}
              </div>
              {it.files.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-xs">
                  {it.files.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center gap-2 text-slate-600">
                      <span className={cn("h-2 w-2 rounded-full", f.status === "VALIDATED" ? "bg-emerald-600" : f.status === "REJECTED" ? "bg-red-500" : "bg-slate-400")} />
                      {f.source === "E_SIGNATURE" ? (
                        <Link href={it.type === "CONVENTION" ? `/documents/convention/${e.id}` : `/documents/signed/${f.id}`} className="link">Signé en ligne</Link>
                      ) : (
                        <a href={`/api/learner-documents/${f.id}?inline=1`} target="_blank" className="link">{f.fileName}</a>
                      )}
                      <span>{DOC_SOURCE[f.source as keyof typeof DOC_SOURCE]} · {formatDate(f.createdAt, true)}</span>
                      {f.status === "REJECTED" && f.comment && <span className="text-red-600">Motif : {f.comment}</span>}
                      {f.status === "PENDING" && f.source === "LEARNER_UPLOAD" && !locked && (
                        <form action={deleteEnrollmentDocumentAction.bind(null, f.id)}>
                          <button className="text-red-600 hover:underline">Supprimer</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!locked && (it.state === "MISSING" || it.state === "REJECTED") && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {it.esignable && (
                    <Link href={it.type === "CONVENTION" ? `/documents/convention/${e.id}` : `/enrollments/${e.id}/sign/${it.type}`} className="btn-primary btn-sm">
                      <FileSignature className="h-3.5 w-3.5" /> Lire et signer en ligne
                    </Link>
                  )}
                  {refUrl(it.type) && (
                    <a href={refUrl(it.type)!} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">Télécharger le document</a>
                  )}
                  <div className="w-full">
                    <p className="mb-1.5 text-xs text-slate-500">{it.esignable ? "Ou déposez la version signée (scan, photo ou PDF) :" : "Déposez le document signé (scan, photo ou PDF) :"}</p>
                    <DocumentUpload action={uploadEnrollmentDocumentAction.bind(null, e.id)} type={it.type} label="Déposer" />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {extraDocs.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4 text-sm">
            <div className="mb-2 font-medium text-slate-900">Autres documents</div>
            <ul className="space-y-1 text-xs text-slate-600">
              {extraDocs.map((f) => (
                <li key={f.id}>
                  <a href={`/api/learner-documents/${f.id}?inline=1`} target="_blank" className="link">{f.fileName ?? "Document signé"}</a> · {formatDate(f.createdAt, true)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </Container>
  );
}
