import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fileResponseHeaders } from "@/lib/uploads";

/** Justificatif d'absence : le stagiaire concerné ou l'équipe de la formation. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  const rec = await db.absenceRecord.findUnique({ where: { id }, include: { slot: { select: { session: { select: { courseId: true, course: { select: { organizationId: true } } } } } } } });
  if (!rec?.data || !rec.fileName || !rec.fileType) return new NextResponse("Introuvable", { status: 404 });
  const own = rec.userId === user.id;
  if (!own && !(await canManageCourse(user, rec.slot.session.courseId))) return new NextResponse("Accès refusé", { status: 403 });
  if (!own) await audit("document.download", { actorId: user.id, organizationId: rec.slot.session.course.organizationId, entityType: "AbsenceRecord", entityId: id });
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(Buffer.from(rec.data), { headers: fileResponseHeaders(rec.fileName, rec.fileType, inline) });
}
