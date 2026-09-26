import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { computeResults } from "@/lib/results";
import { ResultsView } from "@/components/quality/ResultsView";
import { Container, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  return db.organization.findFirst({ where: { slug, active: true, publishResults: true }, select: { id: true, name: true, legalName: true, nda: true, qualiopiCertified: true, qualiopiNumber: true, resultsNote: true } });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const org = await load((await params).slug);
  return { title: org ? `Indicateurs de résultats · ${org.name}` : "Indicateurs de résultats" };
}

/** Page publique des indicateurs de résultats d'un organisme (Qualiopi, indicateurs 2 et 3). */
export default async function PublicResults({ params }: { params: Promise<{ slug: string }> }) {
  const org = await load((await params).slug);
  if (!org) notFound();
  const [r, certifying] = await Promise.all([
    computeResults(org.id),
    db.course.findMany({ where: { organizationId: org.id, status: "PUBLISHED", rncpCode: { not: null } }, select: { title: true, rncpCode: true, certSuccessRate: true, certCandidates: true, certPeriod: true }, orderBy: { title: "asc" } }),
  ]);
  return (
    <Container className="max-w-5xl">
      <PageHeader
        title={`Nos résultats`}
        subtitle={`${org.legalName ?? org.name}${org.nda ? ` · déclaration d'activité n° ${org.nda}` : ""}${org.qualiopiCertified && org.qualiopiNumber ? ` · certifié Qualiopi n° ${org.qualiopiNumber}` : ""}`}
      />
      <ResultsView r={r} certifying={certifying} note={org.resultsNote} />
    </Container>
  );
}
