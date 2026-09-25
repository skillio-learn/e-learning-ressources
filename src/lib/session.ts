// Sessions signées (JWT HS256) stockées dans un cookie httpOnly.
// Ce fichier est compatible Edge (utilisé par le middleware).
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "lms_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

export type SessionPayload = { uid: string; role: Role; name: string; sv?: number };

function secret() {
  const s = process.env.AUTH_SECRET;
  // Refus des secrets absents, trop courts ou recopiés depuis .env.example (sessions falsifiables)
  const weak = !s || s.length < 16 || /changez-moi|change-me|changeme|dev-secret/i.test(s);
  if (weak) {
    if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== undefined) throw new Error("AUTH_SECRET manquant, trop court ou non personnalisé");
    return new TextEncoder().encode(s && s.length >= 16 ? s : "dev-secret-dev-secret-dev-secret");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SEC,
};
