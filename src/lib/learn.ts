import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { requireUser } from "./auth";
import { canManageCourse } from "./permissions";
import { getCourseOutline } from "./progress";
import { learnerCanAccess } from "./onboarding";

/**
 * Contexte d'apprentissage d'une formation : apprenant inscrit, ou formateur/admin en mode aperçu.
 */
export const getLearnContext = cache(async (slug: string) => {
  const user = await requireUser();
  const course = await db.course.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, status: true, sequential: true, certificateEnabled: true, passingScore: true, enrollmentPolicy: true },
  });
  if (!course) notFound();
  const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } });
  const manager = await canManageCourse(user, course.id);

  if (!enrollment || enrollment.status === "SUSPENDED") {
    if (!manager) {
      if (course.status === "PUBLISHED") redirect(`/courses/${course.slug}`);
      notFound();
    }
  }
  // Apprenant inscrit : le parcours n'est accessible qu'une fois l'accès ouvert par l'OF (documents validés)
  if (enrollment && !manager && !learnerCanAccess(user.accountStatus, enrollment)) redirect(`/enrollments/${enrollment.id}`);
  const preview = !enrollment && manager;
  const outline = await getCourseOutline(course.id, user.id, { ignoreLocks: preview });
  if (!outline) notFound();
  return { user, course, enrollment, preview, manager, outline };
});
