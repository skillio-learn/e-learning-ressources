import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { fileResponseHeaders } from "@/lib/uploads";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  const sub = await db.submission.findUnique({
    where: { id },
    select: { userId: true, fileData: true, fileName: true, fileType: true, lesson: { select: { module: { select: { courseId: true } } } } },
  });
  if (!sub?.fileData) return new NextResponse("Introuvable", { status: 404 });
  if (sub.userId !== user.id && !(await canManageCourse(user, sub.lesson.module.courseId))) {
    return new NextResponse("Accès refusé", { status: 403 });
  }
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(Buffer.from(sub.fileData), { headers: fileResponseHeaders(sub.fileName ?? "fichier", sub.fileType ?? "application/octet-stream", inline) });
}
