import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "./auth";
import { canManageCourse, canManageOrg } from "./permissions";
import { enrollmentTrace } from "./reports";
import { audit } from "./audit";

/** Charge la traçabilité d'une inscription si l'utilisateur y a droit (apprenant concerné ou équipe OF). */
export async function loadTraceForViewer(enrollmentId: string, docType: string) {
  const user = await requireUser();
  const trace = await enrollmentTrace(enrollmentId);
  if (!trace) notFound();
  const e = trace.enrollment;
  const allowed =
    e.userId === user.id || canManageOrg(user, e.course.organization.id) || (await canManageCourse(user, e.course.id));
  if (!allowed) notFound();
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
