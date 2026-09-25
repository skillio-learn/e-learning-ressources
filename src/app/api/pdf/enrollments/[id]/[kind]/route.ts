import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageCourse, canManageOrg } from "@/lib/permissions";
import { enrollmentTrace } from "@/lib/reports";
import { audit } from "@/lib/audit";
import { pdfResponse, pdfSlug } from "@/lib/pdf";
import { realisationPdf, relevePdf } from "@/lib/pdf-documents";

const KINDS = { realisation: "certificat-de-realisation", releve: "releve-de-connexions" } as const;

/**
 * Documents de fin de formation en PDF.
 * - Apprenant : les siens, une fois la formation terminée (ou interrompue).
 * - Équipe de l'OF : à tout moment (justificatifs pour les financeurs).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  if (!(kind in KINDS)) return new NextResponse("Document inconnu", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  const e = await db.enrollment.findUnique({
    where: { id },
    select: { id: true, userId: true, courseId: true, status: true, exitDate: true, course: { select: { organizationId: true, title: true } }, user: { select: { name: true } } },
  });
  if (!e) return new NextResponse("Introuvable", { status: 404 });
  const own = e.userId === user.id;
  const staff = !own && (canManageOrg(user, e.course.organizationId) || (await canManageCourse(user, e.courseId)));
  if (!own && !staff) return new NextResponse("Accès refusé", { status: 403 });
  if (own && !(e.status === "COMPLETED" || e.status === "ABANDONED" || e.exitDate)) {
    return new NextResponse("Disponible à la fin de votre formation.", { status: 403 });
  }
  const trace = await enrollmentTrace(id);
  if (!trace) return new NextResponse("Introuvable", { status: 404 });
  const bytes = kind === "realisation" ? await realisationPdf(trace) : await relevePdf(trace);
  if (staff) {
    await audit("export.report", { actorId: user.id, organizationId: e.course.organizationId, entityType: "Enrollment", entityId: e.id, details: { document: kind, format: "pdf" } });
  }
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return pdfResponse(bytes, `${KINDS[kind as keyof typeof KINDS]}-${pdfSlug(e.user.name)}-${pdfSlug(e.course.title)}.pdf`, inline);
}
