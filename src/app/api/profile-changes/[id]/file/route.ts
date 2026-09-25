import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageOrg } from "@/lib/permissions";
import { fileResponseHeaders } from "@/lib/uploads";

/** Justificatif joint à une demande de modification : l'apprenant concerné ou un responsable de son OF. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  const r = await db.profileChangeRequest.findUnique({
    where: { id },
    select: { userId: true, data: true, fileName: true, fileType: true, user: { select: { organizationId: true } } },
  });
  if (!r?.data || !r.fileName || !r.fileType) return new NextResponse("Introuvable", { status: 404 });
  const allowed = r.userId === user.id || (user.role === "OF_ADMIN" && canManageOrg(user, r.user.organizationId));
  if (!allowed) return new NextResponse("Accès refusé", { status: 403 });
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(Buffer.from(r.data), { headers: fileResponseHeaders(r.fileName, r.fileType, inline) });
}
