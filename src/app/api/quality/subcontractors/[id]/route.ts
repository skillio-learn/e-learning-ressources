import { db } from "@/lib/db";
import { canReadQualityFile } from "@/lib/quality-access";
import { fileResponseHeaders } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await db.subcontractor.findUnique({ where: { id }, select: { organizationId: true, contractFileName: true, contractFileType: true, contractData: true } });
  if (!s?.contractData || !s.contractFileName || !s.contractFileType) return new Response("Introuvable", { status: 404 });
  if (!(await canReadQualityFile(s.organizationId, new URL(req.url).searchParams.get("t")))) return new Response("Accès refusé", { status: 403 });
  return new Response(Buffer.from(s.contractData), { headers: fileResponseHeaders(s.contractFileName, s.contractFileType) });
}
