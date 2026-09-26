import { loadCompanyConvention } from "@/lib/document-access";
import { DocShell } from "@/components/documents/DocShell";
import { ConventionBody } from "@/components/company/ConventionBody";

export const dynamic = "force-dynamic";
export const metadata = { title: "Convention de formation entreprise" };

export default async function CompanyConventionDoc({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { conv, text } = await loadCompanyConvention(id);
  const org = conv.organization;
  return (
    <DocShell org={org} title={`Convention de formation professionnelle n° ${conv.reference}`} subtitle="Articles L.6353-1 et D.6353-1 du Code du travail">
      <ConventionBody conv={conv} text={text} orgSignature={org.signatureImage} orgSigner={[org.managerName, org.managerTitle].filter(Boolean).join(", ") || "Le représentant légal"} />
    </DocShell>
  );
}
