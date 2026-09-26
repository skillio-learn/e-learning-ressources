import Link from "next/link";
import { loadCompanyConvention } from "@/lib/document-access";
import { ConventionBody } from "@/components/company/ConventionBody";
import { ConventionSign } from "@/components/company/ConventionSign";
import { Badge, Container, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Convention" };

export default async function CompanyConventionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, conv, text } = await loadCompanyConvention(id);
  const org = conv.organization;
  const canSign = user.role === "COMPANY" && conv.status === "SENT" && !!conv.session;
  return (
    <Container className="max-w-4xl">
      <PageHeader
        back={{ href: user.role === "COMPANY" ? "/entreprise" : `/of/companies/${conv.companyId}`, label: user.role === "COMPANY" ? "Mon espace" : conv.company.name }}
        title={`Convention ${conv.reference}`}
        subtitle={`${org.name} · ${conv.session?.name ?? ""}`}
        actions={<Badge tone={conv.status === "SIGNED" ? "green" : conv.status === "SENT" ? "amber" : "gray"}>{conv.status === "SIGNED" ? "Signée" : conv.status === "SENT" ? "À signer" : "Annulée"}</Badge>}
      />
      {conv.status === "SIGNED" && (
        <p className="mb-4 rounded-[10px] bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Convention signée le {formatDate(conv.signedAt, true)} par {conv.signerName}. Elle reste disponible dans votre espace.
        </p>
      )}
      <article className="card p-6 sm:p-8">
        <ConventionBody conv={conv} text={text} orgSignature={org.signatureImage} orgSigner={[org.managerName, org.managerTitle].filter(Boolean).join(", ") || "Le représentant légal"} />
      </article>
      {canSign && (
        <section className="card mt-6 p-6">
          <h2 className="mb-3 text-xl">Signer en ligne</h2>
          <ConventionSign id={conv.id} signerName={user.name} />
        </section>
      )}
      <p className="mt-4 text-sm"><Link href={`/documents/convention-entreprise/${conv.id}`} className="link">Version imprimable (PDF)</Link></p>
    </Container>
  );
}
