import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { DossierView } from "@/components/quality/DossierView";
import { PrintButton } from "@/components/PrintButton";
import { Container, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Dossier de preuves Qualiopi", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Consultation du dossier de preuves par l'auditeur (lien temporaire, lecture seule, consultations tracées). */
export default async function AuditorView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await db.auditorAccess.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!access || access.revokedAt || access.expiresAt < new Date()) notFound();
  await db.auditorAccess.update({ where: { id: access.id }, data: { lastUsedAt: new Date() } });
  await db.auditLog.create({ data: { organizationId: access.organizationId, action: "quality.auditor_view", entityType: "AuditorAccess", entityId: access.id, details: access.label } });
  return (
    <Container className="max-w-5xl">
      <PageHeader title="Dossier de preuves" subtitle={`Accès en lecture seule pour ${access.label}, valable jusqu'au ${formatDate(access.expiresAt)}.`} actions={<PrintButton label="Imprimer / PDF" />} />
      <DossierView orgId={access.organizationId} token={token} />
    </Container>
  );
}
