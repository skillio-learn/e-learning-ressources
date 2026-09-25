import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { CurrentUser } from "./auth";

/**
 * Règles d'accès :
 * - ADMIN (Vylia) : tout.
 * - OF_ADMIN : toutes les formations et données de son organisme.
 * - TRAINER : formations de son organisme dont il est auteur ou co-formateur.
 */
export function manageableCoursesWhere(user: CurrentUser): Prisma.CourseWhereInput {
  if (user.role === "ADMIN") return {};
  if (!user.organizationId) return { id: "__none__" };
  if (user.role === "OF_ADMIN") return { organizationId: user.organizationId };
  if (user.role === "TRAINER") {
    return {
      organizationId: user.organizationId,
      OR: [{ authorId: user.id }, { trainers: { some: { userId: user.id } } }],
    };
  }
  return { id: "__none__" };
}

export async function canManageCourse(user: CurrentUser, courseId: string) {
  if (user.role === "LEARNER") return false;
  const course = await db.course.findFirst({ where: { id: courseId, ...manageableCoursesWhere(user) }, select: { id: true } });
  return !!course;
}

export async function assertCanManageCourse(user: CurrentUser, courseId: string) {
  if (!(await canManageCourse(user, courseId))) notFound();
}

/** Accès aux données administratives d'un OF (dossiers, apprenants, rapports). */
export function canManageOrg(user: CurrentUser, organizationId: string | null | undefined) {
  if (user.role === "ADMIN") return true;
  return user.role === "OF_ADMIN" && !!organizationId && user.organizationId === organizationId;
}

export function assertCanManageOrg(user: CurrentUser, organizationId: string | null | undefined) {
  if (!canManageOrg(user, organizationId)) notFound();
}

/** Filtre « organisme » pour les listes de l'espace OF. L'admin voit tout (ou l'OF choisi). */
export function orgFilter(user: CurrentUser, selectedOrgId?: string | null): { organizationId?: string } {
  if (user.role === "ADMIN") return selectedOrgId ? { organizationId: selectedOrgId } : {};
  return { organizationId: user.organizationId ?? "__none__" };
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

export async function canManageRubric(user: CurrentUser, rubricId: string) {
  if (user.role === "ADMIN") return true;
  if (user.role === "LEARNER") return false;
  const r = await db.rubric.findUnique({
    where: { id: rubricId },
    select: { authorId: true, courseId: true, author: { select: { organizationId: true } } },
  });
  if (!r) return false;
  if (r.authorId === user.id) return true;
  if (r.courseId) return canManageCourse(user, r.courseId);
  return user.role === "OF_ADMIN" && r.author.organizationId === user.organizationId;
}

/** Un membre de l'équipe OF peut-il consulter le dossier de cet apprenant ? */
export async function canViewLearner(user: CurrentUser, learnerId: string) {
  if (user.role === "ADMIN") return true;
  if (user.role === "LEARNER") return user.id === learnerId;
  if (user.role === "OF_ADMIN" && user.organizationId) {
    const own = await db.user.count({ where: { id: learnerId, organizationId: user.organizationId } });
    if (own) return true;
  }
  const courseWhere = manageableCoursesWhere(user);
  const [enr, app] = await Promise.all([
    db.enrollment.count({ where: { userId: learnerId, course: courseWhere } }),
    user.role === "OF_ADMIN"
      ? db.application.count({ where: { userId: learnerId, course: { organizationId: user.organizationId ?? "__none__" } } })
      : Promise.resolve(0),
  ]);
  return enr + app > 0;
}
