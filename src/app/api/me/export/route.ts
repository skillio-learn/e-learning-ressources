import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

/** Droit d'accès / portabilité (RGPD art. 15 et 20) : export JSON de toutes les données personnelles. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  const data = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, email: true, name: true, role: true, phone: true, createdAt: true, lastLoginAt: true, consentAt: true,
      profile: true,
      applications: { include: { documents: { select: { type: true, fileName: true, status: true, comment: true, uploadedAt: true } }, events: { where: { type: { not: "NOTE" } } } } },
      enrollments: { include: { course: { select: { title: true } } } },
      lessonProgress: true,
      quizAttempts: { include: { answers: true } },
      submissions: { select: { lessonId: true, text: true, linkUrl: true, fileName: true, status: true, score: true, feedback: true, submittedAt: true } },
      certificates: true,
      loginEvents: { orderBy: { createdAt: "desc" } },
      activitySessions: { orderBy: { startedAt: "desc" } },
      timeLogs: { orderBy: { startedAt: "desc" } },
      signatures: { select: { slotId: true, signedAt: true, ip: true } },
      satisfactions: true,
      complaints: true,
      notifications: true,
    },
  });
  await audit("rgpd.export", { actorId: user.id, organizationId: user.organizationId, entityType: "User", entityId: user.id });
  return new NextResponse(JSON.stringify({ exportedAt: new Date(), data }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
