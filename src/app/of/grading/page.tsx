import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { manageableCoursesWhere } from "@/lib/permissions";
import { Badge, Container, Empty, PageHeader } from "@/components/ui";
import { formatDate, pct } from "@/lib/utils";

export const metadata = { title: "Corrections" };
export const dynamic = "force-dynamic";

export default async function Grading({ searchParams }: { searchParams: Promise<{ course?: string; tab?: string }> }) {
  const user = await requireRole("ADMIN", "OF_ADMIN", "TRAINER");
  const { course, tab = "todo" } = await searchParams;
  const courses = await db.course.findMany({ where: manageableCoursesWhere(user), select: { id: true, title: true }, orderBy: { title: "asc" } });
  const ids = course && courses.some((c) => c.id === course) ? [course] : courses.map((c) => c.id);
  const todo = tab === "todo";

  const [attempts, submissions] = await Promise.all([
    db.quizAttempt.findMany({
      where: {
        quiz: { lesson: { module: { courseId: { in: ids } } } },
        status: todo ? "PENDING_REVIEW" : "GRADED",
      },
      orderBy: { submittedAt: todo ? "asc" : "desc" },
      take: todo ? undefined : 50,
      include: {
        user: { select: { name: true } },
        quiz: { select: { lesson: { select: { title: true, module: { select: { course: { select: { title: true } } } } } } } },
      },
    }),
    db.submission.findMany({
      where: {
        lesson: { module: { courseId: { in: ids } } },
        status: todo ? "SUBMITTED" : { in: ["GRADED", "NEEDS_REVISION"] },
      },
      orderBy: { submittedAt: todo ? "asc" : "desc" },
      take: todo ? undefined : 50,
      include: {
        user: { select: { name: true } },
        lesson: { select: { title: true, module: { select: { course: { select: { title: true } } } } } },
      },
    }),
  ]);

  const items = [
    ...submissions.map((s) => ({
      id: s.id, kind: "Devoir" as const, href: `/of/grading/submissions/${s.id}`, learner: s.user.name, title: s.lesson.title,
      course: s.lesson.module.course.title, date: s.submittedAt, percent: s.percent, status: s.status,
    })),
    ...attempts.map((a) => ({
      id: a.id, kind: "Quiz" as const, href: `/of/grading/attempts/${a.id}`, learner: a.user.name, title: a.quiz.lesson.title,
      course: a.quiz.lesson.module.course.title, date: a.submittedAt ?? a.startedAt, percent: a.percent, status: a.status,
    })),
  ].sort((a, b) => (todo ? a.date.getTime() - b.date.getTime() : b.date.getTime() - a.date.getTime()));

  const q = (t: string) => `/of/grading?tab=${t}${course ? `&course=${course}` : ""}`;
  return (
    <Container>
      <PageHeader title="Corrections & évaluations" subtitle="Devoirs à évaluer avec les grilles et questions ouvertes de quiz à corriger." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={q("todo")} className={todo ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>À corriger</Link>
        <Link href={q("done")} className={!todo ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>Déjà corrigés</Link>
        <form className="ml-auto flex gap-2">
          <input type="hidden" name="tab" value={tab} />
          <select name="course" defaultValue={course ?? ""} className="input w-auto">
            <option value="">Toutes les formations</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <button className="btn-secondary btn-sm">Filtrer</button>
        </form>
      </div>
      {items.length === 0 ? (
        <Empty title={todo ? "Rien à corriger" : "Aucune correction"} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Type</th><th>Apprenant</th><th>Évaluation</th><th>Formation</th><th>Remis le</th><th>Note</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td><Badge tone={i.kind === "Devoir" ? "purple" : "blue"}>{i.kind}</Badge></td>
                  <td className="font-medium">{i.learner}</td>
                  <td>{i.title}</td>
                  <td className="text-slate-500">{i.course}</td>
                  <td className="text-xs">{formatDate(i.date, true)}</td>
                  <td>{todo ? "—" : pct(i.percent)}</td>
                  <td className="text-right"><Link href={i.href} className="btn-primary btn-sm">{todo ? "Corriger" : "Voir"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
