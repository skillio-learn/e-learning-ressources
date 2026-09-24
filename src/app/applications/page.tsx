import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Container, Empty, PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/applications/StatusBadge";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Mes dossiers" };
export const dynamic = "force-dynamic";

export default async function MyApplications() {
  const user = await requireUser();
  const apps = await db.application.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      course: { select: { title: true, slug: true, organization: { select: { name: true } } } },
      documents: { select: { status: true } },
    },
  });
  return (
    <Container className="max-w-5xl">
      <PageHeader title="Mes dossiers de candidature" subtitle="Suivez l'avancement de vos inscriptions et échangez avec l'organisme de formation." />
      {apps.length === 0 ? (
        <Empty title="Aucun dossier">
          <Link href="/courses" className="text-brand-600 hover:underline">Choisir une formation dans le catalogue</Link>
        </Empty>
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <Link key={a.id} href={`/applications/${a.id}`} className="card flex flex-wrap items-center gap-4 p-5 hover:shadow-md">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-400">{a.number} · {a.course.organization.name}</div>
                <div className="font-semibold">{a.course.title}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Mis à jour le {formatDate(a.updatedAt, true)} · {a.documents.length} justificatif(s)
                  {a.documents.some((d) => d.status === "REJECTED") && <span className="text-red-600"> · pièce(s) à remplacer</span>}
                </div>
              </div>
              <StatusBadge status={a.status} />
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
