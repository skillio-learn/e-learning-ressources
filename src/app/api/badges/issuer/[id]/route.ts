import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { OB_CONTEXT, badgeUrls, obJson } from "@/lib/badges";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await db.organization.findUnique({ where: { id }, select: { id: true, name: true, legalName: true, slug: true, email: true, website: true } });
  if (!o) return new Response("Introuvable", { status: 404 });
  return obJson({
    "@context": OB_CONTEXT,
    type: "Issuer",
    id: badgeUrls.issuer(o.id),
    name: o.legalName ?? o.name,
    url: o.website ?? appUrl(`/o/${o.slug}`),
    ...(o.email ? { email: o.email } : {}),
  });
}
