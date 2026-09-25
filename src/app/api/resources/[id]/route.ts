import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { learnerCanAccess } from "@/lib/onboarding";
import { startedModuleIds } from "@/lib/progress";
import { fileResponseHeaders } from "@/lib/uploads";

/**
 * Ressource d'un module.
 * Équipe pédagogique : toujours. Apprenant : accès ouvert à la formation et module démarré.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  const r = await db.resource.findUnique({
    where: { id },
    select: { id: true, url: true, data: true, fileName: true, fileType: true, moduleId: true, module: { select: { courseId: true } } },
  });
  if (!r) return new NextResponse("Introuvable", { status: 404 });
  const courseId = r.module.courseId;
  let allowed = await canManageCourse(user, courseId);
  if (!allowed && user.role === "LEARNER") {
    const e = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId } }, select: { accessStatus: true, status: true } });
    allowed = !!e && learnerCanAccess(user.accountStatus, e) && (await startedModuleIds(user.id, courseId)).has(r.moduleId);
  }
  if (!allowed) return new NextResponse("Ressource disponible dès que vous avez commencé ce module.", { status: 403 });
  if (r.url) return NextResponse.redirect(r.url);
  if (!r.data || !r.fileName || !r.fileType) return new NextResponse("Introuvable", { status: 404 });
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(Buffer.from(r.data), { headers: fileResponseHeaders(r.fileName, r.fileType, inline) });
}
