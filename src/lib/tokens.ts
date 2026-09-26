import "server-only";
import { createHash } from "crypto";

/** Empreinte SHA-256 d'un jeton secret (seule l'empreinte est stockée en base). */
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
