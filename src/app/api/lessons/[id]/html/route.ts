import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";

/** Sert le HTML importé d'un module interactif, dans un bac à sable (origine opaque). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  const lesson = await db.lesson.findUnique({
    where: { id },
    select: { htmlContent: true, published: true, module: { select: { courseId: true } } },
  });
  if (!lesson?.htmlContent) return new NextResponse("Introuvable", { status: 404 });
  // Apprenant : leçon publiée d'une formation dont l'accès est ouvert (compte validé)
  const enrolled =
    lesson.published && user.role === "LEARNER" && user.accountStatus === "ACTIVE"
      ? await db.enrollment.findFirst({ where: { userId: user.id, courseId: lesson.module.courseId, status: { not: "SUSPENDED" }, accessStatus: "GRANTED" } })
      : null;
  if (!enrolled && !(await canManageCourse(user, lesson.module.courseId))) {
    return new NextResponse("Accès refusé", { status: 403 });
  }
  return new NextResponse(lesson.htmlContent, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
