import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "./auth";
import { canManageCourse, canManageOrg } from "./permissions";
import { enrollmentTrace } from "./reports";
import { audit } from "./audit";
import { db } from "./db";

/** Charge la traçabilité d'une inscription si l'utilisateur y a droit (apprenant concerné ou équipe OF). */
export async function loadTraceForViewer(enrollmentId: string, docType: string, opts: { learnerRequiresFinished?: boolean } = {}) {
  const user = await requireUser();
  const trace = await enrollmentTrace(enrollmentId);
  if (!trace) notFound();
  const e = trace.enrollment;
  const allowed =
    e.userId === user.id || canManageOrg(user, e.course.organization.id) || (await canManageCourse(user, e.course.id));
  if (!allowed) notFound();
  // Un certificat de réalisation n'est délivré à l'apprenant qu'à la fin (ou à l'interruption) de sa formation
  if (opts.learnerRequiresFinished && e.userId === user.id && !(e.status === "COMPLETED" || e.status === "ABANDONED" || e.exitDate)) notFound();
  if (e.userId !== user.id) {
    await audit("export.report", {
      actorId: user.id,
      organizationId: e.course.organization.id,
      entityType: "Enrollment",
      entityId: e.id,
      details: { document: docType },
    });
  }
  return { user, trace };
}

/** Inscription complète (convention, convocation) si l'utilisateur y a droit. */
export async function loadEnrollmentForViewer(enrollmentId: string, docType: string) {
  const user = await requireUser();
  const e = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      user: { select: { id: true, name: true, email: true, profile: true } },
      course: {
        include: {
          organization: true,
          modules: { orderBy: { position: "asc" }, include: { lessons: { where: { published: true }, orderBy: { position: "asc" }, select: { title: true, durationMin: true } } } },
        },
      },
      session: true,
      application: { select: { number: true, fundingDetails: true } },
    },
  });
  if (!e) notFound();
  const allowed = e.userId === user.id || canManageOrg(user, e.course.organizationId) || (await canManageCourse(user, e.courseId));
  if (!allowed) notFound();
  if (e.userId !== user.id) {
    await audit("export.report", { actorId: user.id, organizationId: e.course.organizationId, entityType: "Enrollment", entityId: e.id, details: { document: docType } });
  }
  return { user, enrollment: e, isLearner: e.userId === user.id };
}
