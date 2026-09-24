import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { OrganizationForm } from "@/components/of/OrganizationForm";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminOrganization({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("ADMIN");
  const org = await db.organization.findUnique({ where: { id } });
  if (!org) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader
        back={{ href: "/admin/organizations", label: "Organismes" }}
        title={org.name}
        actions={<Link href={`/of/team?org=${org.id}`} className="btn-secondary">Équipe de l&apos;OF</Link>}
      />
      <OrganizationForm org={org} />
    </div>
  );
}
