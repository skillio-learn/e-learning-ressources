import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageOrg } from "@/lib/permissions";
import { audit } from "@/lib/audit";

/** Téléchargement / aperçu d'une pièce apprenant (propriétaire ou gestionnaire de l'OF concerné). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  const doc = await db.learnerDocument.findUnique({
    where: { id },
    include: { enrollment: { select: { course: { select: { organizationId: true } } } } },
  });
  if (!doc) return new NextResponse("Introuvable", { status: 404 });
  const orgId = doc.enrollment?.course.organizationId ?? doc.organizationId;
  const staff = user.id !== doc.userId && canManageOrg(user, orgId);
  if (!staff && doc.userId !== user.id) return new NextResponse("Accès refusé", { status: 403 });
  if (!doc.data || !doc.fileType || !doc.fileName) {
    // Document signé en ligne : consultable sous forme de page
    return NextResponse.redirect(new URL(`/documents/signed/${doc.id}`, req.url));
  }
  if (staff) {
    await audit("document.download", { actorId: user.id, organizationId: orgId, entityType: "LearnerDocument", entityId: doc.id, details: { type: doc.type } });
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
