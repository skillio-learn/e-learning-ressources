import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { OB_CONTEXT, badgeUrls, obJson } from "@/lib/badges";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.course.findUnique({ where: { id }, select: { id: true, slug: true, title: true, subtitle: true, objectives: true, durationHours: true, organizationId: true, certificates: { take: 1, select: { id: true } } } });
  // Seules les formations ayant délivré au moins un certificat exposent leur badge
  if (!c || !c.certificates.length) return new Response("Introuvable", { status: 404 });
  return obJson({
    "@context": OB_CONTEXT,
    type: "BadgeClass",
    id: badgeUrls.badgeClass(c.id),
    name: c.title,
    description: c.subtitle ?? `Formation « ${c.title} »${c.durationHours ? ` (${c.durationHours} h)` : ""} suivie et validée.`,
    image: appUrl("/brand/apple-icon.png"),
    criteria: { id: appUrl(`/courses/${c.slug}`), narrative: c.objectives ?? "Suivre l'intégralité du parcours et valider les évaluations requises." },
    issuer: badgeUrls.issuer(c.organizationId),
  });
}
