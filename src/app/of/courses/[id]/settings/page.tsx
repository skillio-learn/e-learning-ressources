import { requireCourseManager } from "@/lib/permissions";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import {
  addCoTrainerAction,
  deleteCourseAction,
  duplicateCourseAction,
  removeCoTrainerAction,
  setCourseStatusAction,
  updateCourseAction,
} from "@/app/actions/of";
import { CourseForm } from "@/components/of/CourseForm";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function CourseSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCourseManager(id);
  const user = await requireStaff();
  const organizations = user.role === "ADMIN" ? await db.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : undefined;
  const course = await db.course.findUniqueOrThrow({
    where: { id },
    include: { author: { select: { name: true, email: true } }, trainers: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <CourseForm action={updateCourseAction.bind(null, id)} course={course} organizations={organizations} />
      <aside className="space-y-4">
        <div className="card space-y-3 p-4">
          <h2 className="text-base">Équipe pédagogique</h2>
          <div className="text-sm">
            <div className="font-medium">{course.author.name}</div>
            <div className="text-xs text-slate-500">Auteur · {course.author.email}</div>
          </div>
          {course.trainers.map((t) => (
            <div key={t.userId} className="flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{t.user.name}</div>
                <div className="text-xs text-slate-500">Co-formateur · {t.user.email}</div>
              </div>
              <form action={removeCoTrainerAction.bind(null, id, t.userId)}>
                <button className="btn-ghost btn-sm text-red-600">✕</button>
              </form>
            </div>
          ))}
          <form action={addCoTrainerAction.bind(null, id)} className="flex gap-2">
            <input name="email" type="email" required placeholder="email du formateur" className="input" />
            <SubmitButton className="btn-secondary btn-sm">Ajouter</SubmitButton>
          </form>
        </div>
        <div className="card space-y-2 p-4">
          <h2 className="text-base">Actions</h2>
          <form action={duplicateCourseAction.bind(null, id)}>
            <SubmitButton className="btn-secondary w-full" pendingLabel="Duplication…">⧉ Dupliquer la formation</SubmitButton>
          </form>
          {course.status !== "ARCHIVED" ? (
            <form action={setCourseStatusAction.bind(null, id, "ARCHIVED")}>
              <SubmitButton className="btn-secondary w-full">Archiver</SubmitButton>
            </form>
          ) : (
            <form action={setCourseStatusAction.bind(null, id, "DRAFT")}>
              <SubmitButton className="btn-secondary w-full">Désarchiver</SubmitButton>
            </form>
          )}
          <form action={deleteCourseAction.bind(null, id)}>
            <SubmitButton className="btn-danger w-full" confirm="Supprimer définitivement la formation, ses leçons, inscriptions et résultats ?">
              Supprimer la formation
            </SubmitButton>
          </form>
        </div>
      </aside>
    </div>
  );
}
