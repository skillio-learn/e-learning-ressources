import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageOrg } from "@/lib/permissions";
import { audit } from "@/lib/audit";

/** Téléchargement / aperçu d'un justificatif (propriétaire ou gestionnaire de l'OF). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  const doc = await db.applicationDocument.findUnique({
    where: { id },
    include: { application: { select: { userId: true, number: true, course: { select: { organizationId: true } } } } },
  });
  if (!doc) return new NextResponse("Introuvable", { status: 404 });
  const staff = canManageOrg(user, doc.application.course.organizationId);
  if (!staff && doc.application.userId !== user.id) return new NextResponse("Accès refusé", { status: 403 });
  if (staff) {
    await audit("document.download", {
      actorId: user.id,
      organizationId: doc.application.course.organizationId,
      entityType: "ApplicationDocument",
      entityId: doc.id,
      details: { number: doc.application.number, type: doc.type },
    });
  }
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const previewable = doc.fileType === "application/pdf" || doc.fileType.startsWith("image/");
  return new NextResponse(Buffer.from(doc.data), {
    headers: {
      "Content-Type": previewable && inline ? doc.fileType : "application/octet-stream",
      "Content-Disposition": `${inline && previewable ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
