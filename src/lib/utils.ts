export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeText(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function pct(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${Math.round(n)} %`;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};
export const optStr = (fd: FormData, key: string) => str(fd, key) || null;
export const optInt = (fd: FormData, key: string) => {
  const v = str(fd, key);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
export const optFloat = (fd: FormData, key: string) => {
  const v = str(fd, key).replace(",", ".");
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
export const bool = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true";

export function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV au format Excel FR (séparateur ; + BOM UTF-8). */
export function toCsv(rows: unknown[][]) {
  return "﻿" + rows.map((r) => r.map(csvEscape).join(";")).join("\r\n");
}

export function safeUrl(u: string | null | undefined) {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function randomCode(len = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export const LESSON_TYPE_LABELS = {
  INTERACTIVE: "Module interactif",
  CONTENT: "Contenu",
  VIDEO: "Vidéo",
  QUIZ: "Quiz",
  ASSIGNMENT: "Devoir évalué",
  RESOURCE: "Ressource",
} as const;

export const LESSON_TYPE_ICONS = {
  INTERACTIVE: "✨",
  CONTENT: "📄",
  VIDEO: "🎬",
  QUIZ: "❓",
  ASSIGNMENT: "📝",
  RESOURCE: "📎",
} as const;

export const ROLE_LABELS = { ADMIN: "Super admin Skillio", OF_ADMIN: "Responsable OF", TRAINER: "Formateur", LEARNER: "Apprenant" } as const;
export const LEVEL_LABELS = { BEGINNER: "Débutant", INTERMEDIATE: "Intermédiaire", ADVANCED: "Avancé" } as const;
export const STATUS_LABELS = { DRAFT: "Brouillon", PUBLISHED: "Publiée", ARCHIVED: "Archivée" } as const;
export const QUESTION_TYPE_LABELS = {
  SINGLE: "QCM – réponse unique",
  MULTIPLE: "QCM – réponses multiples",
  TRUE_FALSE: "Vrai / Faux",
  SHORT: "Réponse courte",
  OPEN: "Question ouverte (correction manuelle)",
} as const;

/** Transforme une URL YouTube / Vimeo en URL d'intégration. */
export function videoEmbed(url: string | null | undefined): { kind: "iframe" | "video"; src: string } | null {
  const u = safeUrl(url);
  if (!u) return null;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) return { kind: "video", src: u };
  return { kind: "iframe", src: u };
}
