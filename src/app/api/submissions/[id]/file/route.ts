import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
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
  return new NextResponse(Buffer.from(sub.fileData), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(sub.fileName ?? "fichier")}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
