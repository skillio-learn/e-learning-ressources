import { db } from "@/lib/db";
import { canReadQualityFile } from "@/lib/quality-access";
import { fileResponseHeaders } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await db.qualityEvidence.findUnique({ where: { id }, select: { organizationId: true, fileName: true, fileType: true, data: true } });
  if (!e?.data || !e.fileName || !e.fileType) return new Response("Introuvable", { status: 404 });
  if (!(await canReadQualityFile(e.organizationId, new URL(req.url).searchParams.get("t")))) return new Response("Accès refusé", { status: 403 });
  return new Response(Buffer.from(e.data), { headers: fileResponseHeaders(e.fileName, e.fileType) });
}
