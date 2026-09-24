import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCourseOutline } from "@/lib/progress";
import { CourseCard } from "@/components/CourseCard";
import { Container, Empty, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Mes formations" };
export const dynamic = "force-dynamic";

export default async function MyCourses() {
  const user = await requireUser();
  const [enrollments, certificates] = await Promise.all([
    db.enrollment.findMany({
      where: { userId: user.id, status: { not: "SUSPENDED" } },
      include: { course: { include: { _count: { select: { modules: true } } } } },
      orderBy: { enrolledAt: "desc" },
    }),
    db.certificate.findMany({ where: { userId: user.id }, include: { course: { select: { title: true } } }, orderBy: { issuedAt: "desc" } }),
  ]);
  const items = await Promise.all(
    enrollments.map(async (e) => ({ e, outline: await getCourseOutline(e.courseId, user.id) })),
  );
  return (
    <Container>
      <PageHeader title="Mes formations" subtitle="Toutes les formations auxquelles vous êtes inscrit(e)." />
      {items.length === 0 ? (
        <Empty title="Vous n'êtes inscrit(e) à aucune formation">
          <Link href="/courses" className="text-brand-600 hover:underline">Découvrir le catalogue</Link>
        </Empty>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ e, outline }) => (
            <CourseCard key={e.id} href={`/learn/${e.course.slug}`} course={e.course} progress={outline?.percent ?? 0} />
          ))}
        </div>
      )}
      {certificates.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3">Mes certificats</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {certificates.map((c) => (
              <Link key={c.id} href={`/certificates/${c.code}`} className="card flex items-center justify-between p-4 hover:shadow-md">
                <div>
                  <div className="font-medium">{c.course.title}</div>
                  <div className="text-xs text-slate-500">Délivré le {formatDate(c.issuedAt)}</div>
                </div>
                <span className="text-sm text-brand-600">Voir →</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
