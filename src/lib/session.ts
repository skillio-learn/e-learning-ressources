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
    // Un jeton typé (défi de double authentification…) n'est jamais une session
    if ((payload as { typ?: string }).typ) return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ─── Défi de double authentification (entre le mot de passe et le code) ───

export const MFA_COOKIE = "lms_mfa";
const MFA_TTL_SEC = 5 * 60;

export async function signMfaChallenge(p: { uid: string; sv: number; next: string }) {
  return new SignJWT({ ...p, typ: "mfa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MFA_TTL_SEC}s`)
    .sign(secret());
}

export async function verifyMfaChallenge(token: string | undefined): Promise<{ uid: string; sv: number; next: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if ((payload as { typ?: string }).typ !== "mfa") return null;
    return payload as unknown as { uid: string; sv: number; next: string };
  } catch {
    return null;
  }
}

export const mfaCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MFA_TTL_SEC,
};

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SEC,
};
