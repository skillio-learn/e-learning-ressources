import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** Pièce jointe d'un ticket : support Vylia, ou responsable de l'OF du ticket (hors notes internes). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  const m = await db.supportTicketMessage.findUnique({
    where: { id },
    select: { data: true, fileName: true, fileType: true, internal: true, ticket: { select: { organizationId: true } } },
  });
  if (!m?.data || !m.fileName || !m.fileType) return new NextResponse("Introuvable", { status: 404 });
  const allowed = user.role === "ADMIN" || (!m.internal && user.role === "OF_ADMIN" && user.organizationId === m.ticket.organizationId);
  if (!allowed) return new NextResponse("Accès refusé", { status: 403 });
  const previewable = m.fileType === "application/pdf" || m.fileType.startsWith("image/");
  const inline = new URL(req.url).searchParams.get("inline") === "1" && previewable;
  return new NextResponse(Buffer.from(m.data), {
    headers: {
      "Content-Type": inline ? m.fileType : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(m.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
