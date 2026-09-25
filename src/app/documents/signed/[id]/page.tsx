import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageOrg } from "@/lib/permissions";
import { ENROLLMENT_DOCUMENTS } from "@/lib/labels";
import { renderMarkdown } from "@/lib/markdown";
import { sha256 } from "@/lib/onboarding";
import { DocShell } from "@/components/documents/DocShell";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Document signé" };
export const dynamic = "force-dynamic";

/** Preuve de signature électronique d'un document (CGV, règlement intérieur…). */
export default async function SignedDocument({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const doc = await db.learnerDocument.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true } }, enrollment: { select: { course: { select: { title: true, organization: true } } } }, reviewedBy: { select: { name: true } } },
  });
  if (!doc || doc.source !== "E_SIGNATURE" || !doc.enrollment) notFound();
  const org = doc.enrollment.course.organization;
  if (doc.userId !== user.id && !canManageOrg(user, org.id)) notFound();
  const text = doc.signedContent ?? "";
  const intact = !!doc.contentHash && sha256(text) === doc.contentHash;
  return (
    <DocShell org={org} title={ENROLLMENT_DOCUMENTS[doc.type]?.label ?? doc.type} subtitle={`Formation : ${doc.enrollment.course.title}`}>
      <div className="prose-lms text-[13px]" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
      <section className="mt-8 grid grid-cols-2 gap-8 border-t border-slate-200 pt-4 text-[13px]">
        <div>
          <div className="font-semibold">Signature de {doc.user.name}</div>
          {doc.signature && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.signature} alt="Signature" className="mt-1 h-16" />
          )}
          <div className="text-xs text-slate-500">
            « Lu et approuvé » — signé électroniquement le {formatDate(doc.createdAt, true)} · IP {doc.signedIp ?? "—"}
          </div>
        </div>
        <div className="text-xs text-slate-500">
          <div>Empreinte SHA-256 du texte signé :</div>
          <div className="break-all font-mono text-[10px]">{doc.contentHash}</div>
          <div className="mt-1">{intact ? "Intégrité vérifiée : le texte affiché est celui qui a été signé." : "Attention : empreinte non concordante."}</div>
          <div className="mt-2">
            Statut : {doc.status === "VALIDATED" ? `validé${doc.reviewedBy ? ` par ${doc.reviewedBy.name}` : ""} le ${formatDate(doc.reviewedAt, true)}` : doc.status === "REJECTED" ? "refusé" : "en attente de vérification"}
          </div>
        </div>
      </section>
    </DocShell>
  );
}
