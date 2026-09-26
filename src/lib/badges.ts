import "server-only";
import { createHash } from "crypto";
import { appUrl } from "./email";

/** Open Badges 2.0 (vérification « hosted ») : émetteur = organisme, badge = formation, assertion = certificat. */
export const OB_CONTEXT = "https://w3id.org/openbadges/v2";
export const badgeUrls = {
  issuer: (orgId: string) => appUrl(`/api/badges/issuer/${orgId}`),
  badgeClass: (courseId: string) => appUrl(`/api/badges/class/${courseId}`),
  assertion: (code: string) => appUrl(`/api/badges/assertion/${code}`),
  certificate: (code: string) => appUrl(`/certificates/${code}`),
};

export const hashedRecipient = (email: string, salt: string) => `sha256$${createHash("sha256").update(email.toLowerCase() + salt).digest("hex")}`;

export const obJson = (body: unknown) =>
  new Response(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/ld+json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" },
  });

/** Lien « Ajouter au profil LinkedIn » (section Licences et certifications). */
export function linkedInAddUrl(p: { name: string; organizationName: string; issuedAt: Date; code: string }) {
  const q = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: p.name,
    organizationName: p.organizationName,
    issueYear: String(p.issuedAt.getFullYear()),
    issueMonth: String(p.issuedAt.getMonth() + 1),
    certUrl: badgeUrls.certificate(p.code),
    certId: p.code,
  });
  return `https://www.linkedin.com/profile/add?${q}`;
}
