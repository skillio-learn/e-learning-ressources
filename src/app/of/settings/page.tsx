import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { OrganizationForm } from "@/components/of/OrganizationForm";
import { Container, PageHeader } from "@/components/ui";

export const metadata = { title: "Paramètres de l'OF" };
export const dynamic = "force-dynamic";

export default async function OfSettings() {
  const user = await requireOfManager();
  if (!user.organizationId) notFound();
  const org = await db.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
  return (
    <Container className="max-w-4xl">
      <PageHeader title="Paramètres de l'organisme" subtitle="Ces informations apparaissent sur les attestations, certificats de réalisation et relevés de connexion." />
      <OrganizationForm org={org} />
    </Container>
  );
}
