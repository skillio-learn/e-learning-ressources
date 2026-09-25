import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageCourse, canManageOrg } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { pdfResponse, pdfSlug } from "@/lib/pdf";
import { quizAttemptPdf } from "@/lib/pdf-documents";

/** PDF des résultats d'un quiz : l'apprenant concerné, le formateur de la formation, les responsables de l'OF. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  const a = await db.quizAttempt.findUnique({
    where: { id },
    select: { userId: true, status: true, quiz: { select: { showCorrection: true, lesson: { select: { module: { select: { courseId: true, course: { select: { organizationId: true } } } } } } } } },
  });
  if (!a || a.status === "IN_PROGRESS") return new NextResponse("Introuvable", { status: 404 });
  const course = a.quiz.lesson.module;
  const own = a.userId === user.id;
  const staff = !own && ((await canManageCourse(user, course.courseId)) || canManageOrg(user, course.course.organizationId));
  if (!own && !staff) return new NextResponse("Accès refusé", { status: 403 });
  const out = await quizAttemptPdf(id, { showCorrection: staff || a.quiz.showCorrection });
  if (!out) return new NextResponse("Introuvable", { status: 404 });
  if (staff) await audit("export.report", { actorId: user.id, organizationId: course.course.organizationId, entityType: "QuizAttempt", entityId: id, details: { document: "resultats-quiz" } });
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return pdfResponse(out.bytes, `resultats-${pdfSlug(out.title)}-${pdfSlug(out.learner)}.pdf`, inline);
}
