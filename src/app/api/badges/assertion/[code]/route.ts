import { db } from "@/lib/db";
import { OB_CONTEXT, badgeUrls, hashedRecipient, obJson } from "@/lib/badges";

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cert = await db.certificate.findUnique({ where: { code }, include: { user: { select: { email: true } } } });
  if (!cert) return new Response("Introuvable", { status: 404 });
  return obJson({
    "@context": OB_CONTEXT,
    type: "Assertion",
    id: badgeUrls.assertion(code),
    recipient: { type: "email", hashed: true, salt: code, identity: hashedRecipient(cert.user.email, code) },
    badge: badgeUrls.badgeClass(cert.courseId),
    issuedOn: cert.issuedAt.toISOString(),
    verification: { type: "hosted" },
    evidence: badgeUrls.certificate(code),
  });
}
