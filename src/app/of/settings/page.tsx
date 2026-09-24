import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { OrganizationForm } from "@/components/of/OrganizationForm";
import { Container, PageHeader } from "@/components/ui";
import { SignaturePad } from "@/components/SignaturePad";
import { SubmitButton } from "@/components/SubmitButton";
import { clearOrgSignatureAction, saveOrgSignatureAction } from "@/app/actions/compliance";

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
      <section className="card mt-6 p-6">
        <h2 className="mb-1">Signature de l&apos;organisme</h2>
        <p className="mb-3 text-sm text-slate-500">Apposée automatiquement sur les conventions, convocations, attestations et certificats de réalisation.</p>
        {org.signatureImage ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={org.signatureImage} alt="Signature" className="paper-sign h-20" />
            <form action={clearOrgSignatureAction.bind(null, org.id)}><SubmitButton className="btn-ghost btn-sm text-red-600">Supprimer</SubmitButton></form>
          </div>
        ) : (
          <div className="max-w-md"><SignaturePad onSign={saveOrgSignatureAction.bind(null, org.id)} label="Enregistrer la signature" /></div>
        )}
      </section>
    </Container>
  );
}
