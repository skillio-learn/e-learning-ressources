import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { assertCanManageCourse } from "@/lib/permissions";
import { setCourseStatusAction } from "@/app/actions/of";
import { CourseTabs } from "@/components/of/CourseTabs";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge } from "@/components/ui";
import { STATUS_LABELS } from "@/lib/utils";

export default async function CourseAdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("ADMIN", "OF_ADMIN", "TRAINER");
  await assertCanManageCourse(user, id);
  const course = await db.course.findUnique({ where: { id }, select: { id: true, title: true, slug: true, status: true } });
  if (!course) notFound();
  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <Link href="/of/courses" className="text-sm text-slate-500 hover:text-brand-600">← Mes formations</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1>{course.title}</h1>
          <Badge tone={course.status === "PUBLISHED" ? "green" : course.status === "DRAFT" ? "amber" : "gray"}>
            {STATUS_LABELS[course.status]}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/learn/${course.slug}`} className="btn-secondary">Prévisualiser</Link>
          {course.status !== "PUBLISHED" ? (
            <form action={setCourseStatusAction.bind(null, course.id, "PUBLISHED")}>
              <SubmitButton className="btn-primary">Publier</SubmitButton>
            </form>
          ) : (
            <form action={setCourseStatusAction.bind(null, course.id, "DRAFT")}>
              <SubmitButton className="btn-secondary" confirm="Repasser la formation en brouillon ? Elle disparaîtra du catalogue.">
                Dépublier
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
      <div className="mt-4">
        <CourseTabs courseId={course.id} />
      </div>
      <div className="pt-6">{children}</div>
    </main>
  );
}
