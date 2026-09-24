import { db } from "@/lib/db";
import { CourseCard } from "@/components/CourseCard";
import { Container, Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Catalogue" };
export const dynamic = "force-dynamic";

export default async function Catalog({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const { q, cat } = await searchParams;
  const [courses, categories] = await Promise.all([
    db.course.findMany({
      where: {
        status: "PUBLISHED",
        ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { subtitle: { contains: q, mode: "insensitive" } }] } : {}),
        ...(cat ? { category: cat } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { modules: true } } },
    }),
    db.course.findMany({ where: { status: "PUBLISHED", category: { not: null } }, distinct: ["category"], select: { category: true } }),
  ]);
  return (
    <Container>
      <PageHeader title="Catalogue des formations" subtitle={`${courses.length} formation(s) disponible(s)`} />
      <form className="mb-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Rechercher une formation…" className="input max-w-sm" />
        <select name="cat" defaultValue={cat ?? ""} className="input max-w-xs">
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.category} value={c.category!}>{c.category}</option>
          ))}
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>
      {courses.length === 0 ? (
        <Empty title="Aucune formation trouvée" />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.id} href={`/courses/${c.slug}`} course={c} />
          ))}
        </div>
      )}
    </Container>
  );
}
