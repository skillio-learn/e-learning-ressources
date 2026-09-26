import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canReadQualityFile } from "@/lib/quality-access";
import { fileResponseHeaders } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/** Justificatif de compétence : le formateur concerné, le responsable ou référent qualité, ou l'auditeur. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await db.trainerQualification.findUnique({ where: { id }, select: { userId: true, organizationId: true, fileName: true, fileType: true, data: true } });
  if (!q?.data || !q.fileName || !q.fileType) return new Response("Introuvable", { status: 404 });
  const user = await getCurrentUser();
  const own = !!user && user.id === q.userId;
  if (!own && !(await canReadQualityFile(q.organizationId, new URL(req.url).searchParams.get("t")))) return new Response("Accès refusé", { status: 403 });
  return new Response(Buffer.from(q.data), { headers: fileResponseHeaders(q.fileName, q.fileType) });
}
