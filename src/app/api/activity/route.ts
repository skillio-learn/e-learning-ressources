import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getClientInfo } from "@/lib/request";
import { recordHeartbeat } from "@/lib/tracking";

/** Battement d'activité envoyé par le navigateur (fetch ou sendBeacon). */
export async function POST(req: Request) {
  // Requête de la plateforme uniquement (pas d'appel inter-sites avec les cookies de l'utilisateur)
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return new NextResponse(null, { status: 403 });
  const user = await getCurrentUser();
  // Après déconnexion, le dernier signal du navigateur est simplement ignoré
  if (!user) return new NextResponse(null, { status: 204 });
  let body: { lessonId?: string | null; seconds?: number } = {};
  try {
    const raw = await req.text();
    if (raw.length > 2000) return NextResponse.json({ error: "bad request" }, { status: 400 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { ip, userAgent } = await getClientInfo();
  const res = await recordHeartbeat(user.id, {
    lessonId: typeof body.lessonId === "string" ? body.lessonId : null,
    seconds: Number(body.seconds) || 0,
    ip,
    userAgent,
  });
  return NextResponse.json(res);
}
