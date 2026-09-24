import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getClientInfo } from "@/lib/request";
import { recordHeartbeat } from "@/lib/tracking";

/** Battement d'activité envoyé par le navigateur (fetch ou sendBeacon). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  // Après déconnexion, le dernier signal du navigateur est simplement ignoré
  if (!user) return new NextResponse(null, { status: 204 });
  let body: { lessonId?: string | null; seconds?: number } = {};
  try {
    body = JSON.parse(await req.text());
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
