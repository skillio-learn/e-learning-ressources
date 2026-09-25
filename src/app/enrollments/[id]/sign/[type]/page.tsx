import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canESign, signedText } from "@/lib/onboarding";
import { ENROLLMENT_DOCUMENTS } from "@/lib/labels";
import { renderMarkdown } from "@/lib/markdown";
import { signEnrollmentDocumentAction } from "@/app/actions/access";
import { SignaturePad } from "@/components/SignaturePad";
import { Container, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Signature d'un document" };
export const dynamic = "force-dynamic";

export default async function SignDocument({ params }: { params: Promise<{ id: string; type: string }> }) {
  const user = await requireUser();
  const { id, type } = await params;
  const e = await db.enrollment.findUnique({ where: { id }, include: { course: { select: { title: true, organization: true } } } });
  if (!e || e.userId !== user.id) notFound();
  const def = ENROLLMENT_DOCUMENTS[type];
  if (!def || def.esign !== "text" || !canESign(type, e.course.organization)) notFound();
  const signed = await db.learnerDocument.findFirst({ where: { enrollmentId: id, type, source: "E_SIGNATURE", status: { not: "REJECTED" } } });
  const text = signedText(type, e.course.organization);

  return (
    <Container className="max-w-3xl">
      <PageHeader back={{ href: `/enrollments/${id}`, label: "Mon inscription" }} title={def.label} subtitle={`${e.course.organization.name} · ${e.course.title}`} />
      <article className="theme-paper rounded-2xl border border-slate-200 p-8 shadow-card">
        <div className="prose-lms text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
      </article>
      <section className="card mt-6 p-6">
        {signed ? (
          <div className="text-sm">
            <p className="font-medium text-emerald-700">Document signé le {formatDate(signed.createdAt, true)}.</p>
            <p className="mt-1 text-slate-600">L&apos;organisme va vérifier votre signature.</p>
            <Link href={`/enrollments/${id}`} className="btn-primary mt-4">Revenir à mon inscription</Link>
          </div>
        ) : (
          <>
            <h2 className="mb-1">Signature</h2>
            <p className="mb-4 text-sm text-slate-500">
              En signant, je reconnais avoir lu et accepté ce document. La signature est horodatée et associée à votre adresse IP ainsi qu&apos;à
              l&apos;empreinte du texte signé.
            </p>
            <SignaturePad onSign={signEnrollmentDocumentAction.bind(null, id, type)} label="Lu et approuvé — signer" />
          </>
        )}
      </section>
    </Container>
  );
}
