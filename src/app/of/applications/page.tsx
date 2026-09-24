import Link from "next/link";
import type { ApplicationStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { manageableCoursesWhere } from "@/lib/permissions";
import { Container, Empty, PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/applications/StatusBadge";
import { APPLICATION_STATUS, FUNDING_TYPES } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Dossiers d'inscription" };
export const dynamic = "force-dynamic";

export default async function OfApplications({ searchParams }: { searchParams: Promise<{ status?: string; course?: string; q?: string }> }) {
  const user = await requireOfManager();
  const { status, course, q } = await searchParams;
  const courses = await db.course.findMany({ where: manageableCoursesWhere(user), select: { id: true, title: true }, orderBy: { title: "asc" } });
  const ids = courses.map((c) => c.id);
  const where: Prisma.ApplicationWhereInput = {
    courseId: course && ids.includes(course) ? course : { in: ids },
    status: status && status in APPLICATION_STATUS ? (status as ApplicationStatus) : { not: "DRAFT" },
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [apps, counts] = await Promise.all([
    db.application.findMany({
      where,
      orderBy: [{ submittedAt: { sort: "asc", nulls: "last" } }],
      take: 300,
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true, organization: { select: { name: true } } } },
        documents: { select: { status: true } },
        session: { select: { name: true } },
      },
    }),
    db.application.groupBy({ by: ["status"], where: { courseId: { in: ids } }, _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status, course, q, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    return `/of/applications?${p}`;
  };
  return (
    <Container>
      <PageHeader title="Dossiers d'inscription" subtitle="Vérifiez les dossiers déposés, demandez des compléments, validez puis inscrivez définitivement." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={qs({ status: undefined })} className={cn("btn-sm", !status ? "btn-primary" : "btn-secondary")}>Tous</Link>
        {(Object.keys(APPLICATION_STATUS) as ApplicationStatus[])
          .filter((s) => s !== "DRAFT")
          .map((s) => (
            <Link key={s} href={qs({ status: s })} className={cn("btn-sm", status === s ? "btn-primary" : "btn-secondary")}>
              {APPLICATION_STATUS[s].label} ({countOf(s)})
            </Link>
          ))}
        <span className="self-center text-xs text-slate-400">+ {countOf("DRAFT")} brouillon(s) non déposé(s)</span>
      </div>
      <form className="mb-4 flex flex-wrap gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Nom, email ou n° de dossier" className="input max-w-xs" />
        <select name="course" defaultValue={course ?? ""} className="input max-w-xs">
          <option value="">Toutes les formations</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>
      {apps.length === 0 ? (
        <Empty title="Aucun dossier" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Dossier</th><th>Apprenant</th><th>Formation / session</th><th>Financement</th><th>Pièces</th><th>Déposé le</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {apps.map((a) => {
                const ok = a.documents.filter((d) => d.status === "VALIDATED").length;
                const ko = a.documents.filter((d) => d.status === "REJECTED").length;
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td><Link href={`/of/applications/${a.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">{a.number}</Link></td>
                    <td>
                      <Link href={`/of/applications/${a.id}`} className="font-medium hover:text-brand-700">{a.user.name}</Link>
                      <div className="text-xs text-slate-500">{a.user.email}</div>
                    </td>
                    <td>
                      {a.course.title}
                      <div className="text-xs text-slate-500">{a.session?.name ?? "—"}{user.role === "ADMIN" ? ` · ${a.course.organization.name}` : ""}</div>
                    </td>
                    <td className="text-xs">{a.fundingType ? FUNDING_TYPES[a.fundingType].split(" (")[0] : "—"}</td>
                    <td className="text-xs">
                      {ok}/{a.documents.length} validée(s){ko ? <span className="text-red-600"> · {ko} refusée(s)</span> : null}
                    </td>
                    <td className="text-xs">{formatDate(a.submittedAt, true)}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
