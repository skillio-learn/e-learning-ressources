import Link from "next/link";
import type { AccessStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { enrollmentRequiredDocs } from "@/lib/onboarding";
import { Badge, Container, Empty, PageHeader } from "@/components/ui";
import { ACCESS_STATUS, ACCOUNT_STATUS } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Accès aux parcours" };
export const dynamic = "force-dynamic";

const TABS: { key: AccessStatus; label: string }[] = [
  { key: "UNDER_REVIEW", label: "À valider" },
  { key: "PENDING_DOCUMENTS", label: "Documents attendus" },
  { key: "GRANTED", label: "Accès ouverts" },
  { key: "REFUSED", label: "Refusés" },
];
const ORIGIN: Record<string, string> = { OF: "Inscrit par l'OF", APPLICATION: "Candidature", SELF: "Demande de l'apprenant" };

export default async function OfAccess({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requireOfManager();
  const { status: s, q } = await searchParams;
  const status = (TABS.some((t) => t.key === s) ? s : "UNDER_REVIEW") as AccessStatus;
  const scope: Prisma.EnrollmentWhereInput = user.role === "ADMIN" ? {} : { course: { organizationId: user.organizationId ?? "__none__" } };
  const [counts, rows] = await Promise.all([
    db.enrollment.groupBy({ by: ["accessStatus"], where: scope, _count: true }),
    db.enrollment.findMany({
      where: {
        ...scope,
        accessStatus: status,
        ...(q ? { user: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } } : {}),
      },
      orderBy: status === "UNDER_REVIEW" ? { accessSubmittedAt: "asc" } : { enrolledAt: "desc" },
      take: 300,
      include: {
        user: { select: { id: true, name: true, email: true, accountStatus: true } },
        course: { select: { title: true, organization: { select: { enrollmentRequiredDocuments: true } } } },
        documents: { select: { type: true, status: true } },
      },
    }),
  ]);
  const count = (k: AccessStatus) => counts.find((c) => c.accessStatus === k)?._count ?? 0;

  return (
    <Container>
      <PageHeader title="Accès aux parcours" subtitle="Documents d'inscription (convention, CGV, règlement intérieur…) et ouverture de l'accès aux formations." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/of/access?status=${t.key}`}
            className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium transition", status === t.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
          >
            {t.label} <span className="ml-1 tabular-nums opacity-70">{count(t.key)}</span>
          </Link>
        ))}
        <form className="ml-auto">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Apprenant" className="input w-56 py-1.5" />
        </form>
      </div>
      {rows.length === 0 ? (
        <Empty title="Aucune inscription dans cette catégorie" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Apprenant</th>
                <th>Formation</th>
                <th>Origine</th>
                <th>Compte</th>
                <th>Documents validés</th>
                <th>{status === "UNDER_REVIEW" ? "Complet le" : "Inscrit le"}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const required = enrollmentRequiredDocs(e.course.organization);
                const validated = required.filter((t) => e.documents.some((d) => d.type === t && d.status === "VALIDATED")).length;
                const toReview = e.documents.filter((d) => d.status === "PENDING").length;
                const acc = ACCOUNT_STATUS[e.user.accountStatus];
                return (
                  <tr key={e.id}>
                    <td>
                      <div className="font-medium text-slate-900">{e.user.name}</div>
                      <div className="text-xs text-slate-500">{e.user.email}</div>
                    </td>
                    <td>{e.course.title}</td>
                    <td>{ORIGIN[e.origin] ?? e.origin}</td>
                    <td><Badge tone={acc.tone}>{acc.label}</Badge></td>
                    <td className="tabular-nums">
                      {validated}/{required.length} {toReview > 0 && <Badge tone="blue">{toReview} à vérifier</Badge>}
                    </td>
                    <td>{formatDate(status === "UNDER_REVIEW" ? e.accessSubmittedAt : e.enrolledAt, true)}</td>
                    <td className="text-right"><Link href={`/of/access/${e.id}`} className="btn-secondary btn-sm">Examiner</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">Statuts : {Object.values(ACCESS_STATUS).map((v) => v.label).join(" · ")}</p>
    </Container>
  );
}
