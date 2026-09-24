import "server-only";
import { headers } from "next/headers";

/** Adresse IP et navigateur de la requête courante (traçabilité). */
export async function getClientInfo() {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0] : h.get("x-real-ip"))?.trim() || null;
  const userAgent = h.get("user-agent")?.slice(0, 400) || null;
  return { ip, userAgent };
}
