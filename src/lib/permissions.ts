import "server-only";
import { notFound } from "next/navigation";
import { db } from "./db";
import type { CurrentUser } from "./auth";

/** Un formateur peut gérer une formation s'il en est l'auteur ou co-formateur. L'admin peut tout gérer. */
export async function canManageCourse(user: CurrentUser, courseId: string) {
  if (user.role === "ADMIN") return true;
  if (user.role !== "TRAINER") return false;
  const course = await db.course.findFirst({
    where: {
      id: courseId,
      OR: [{ authorId: user.id }, { trainers: { some: { userId: user.id } } }],
    },
    select: { id: true },
  });
  return !!course;
}

export async function assertCanManageCourse(user: CurrentUser, courseId: string) {
  if (!(await canManageCourse(user, courseId))) notFound();
}

export async function courseIdForModule(moduleId: string) {
  const m = await db.module.findUnique({ where: { id: moduleId }, select: { courseId: true } });
  if (!m) notFound();
  return m.courseId;
}

export async function courseIdForLesson(lessonId: string) {
  const l = await db.lesson.findUnique({ where: { id: lessonId }, select: { module: { select: { courseId: true } } } });
  if (!l) notFound();
  return l.module.courseId;
}

/** Filtre Prisma des formations gérables par l'utilisateur. */
export function manageableCoursesWhere(user: CurrentUser) {
  if (user.role === "ADMIN") return {};
  return { OR: [{ authorId: user.id }, { trainers: { some: { userId: user.id } } }] };
}

export async function canManageRubric(user: CurrentUser, rubricId: string) {
  if (user.role === "ADMIN") return true;
  if (user.role !== "TRAINER") return false;
  const r = await db.rubric.findUnique({ where: { id: rubricId }, select: { authorId: true, courseId: true } });
  if (!r) return false;
  if (r.authorId === user.id) return true;
  return r.courseId ? canManageCourse(user, r.courseId) : false;
}
