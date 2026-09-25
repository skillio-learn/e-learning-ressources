import "server-only";

/**
 * Dépôts de fichiers. Les fichiers transitent par les fonctions serverless (limite Vercel : 4,5 Mo par requête) :
 * 4 Mo maximum par fichier. Le type réel est vérifié à partir de la signature binaire du fichier,
 * jamais à partir du type annoncé par le navigateur.
 */
export const MAX_UPLOAD_MB = 4;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export type UploadKind = "document" | "image" | "pdf";

const DOC_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
};

const EXT_BY_KIND: Record<UploadKind | "resource" | "assignment", string[]> = {
  assignment: ["pdf", "jpg", "png", "webp", "heic", "doc", "docx", "odt", "xlsx", "pptx", "zip", "mp3", "mp4"],
  document: ["pdf", "jpg", "png", "webp", "heic", "doc", "docx", "odt"],
  image: ["jpg", "png", "webp", "heic"],
  pdf: ["pdf"],
  resource: ["pdf", "jpg", "png", "webp", "doc", "docx", "odt", "xlsx", "pptx", "zip", "mp3", "mp4"],
};

export const ACCEPT_ATTR: Record<UploadKind | "resource" | "assignment", string> = {
  assignment: ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.odt,.xlsx,.pptx,.zip,.mp3,.mp4",
  document: ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.odt",
  image: ".jpg,.jpeg,.png,.webp,.heic",
  pdf: ".pdf",
  resource: ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.odt,.xlsx,.pptx,.zip,.mp3,.mp4",
};

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

/** Type réel déduit des premiers octets (null si non reconnu). */
export function sniffType(b: Uint8Array, fileName: string): string | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";
  if (ascii(b, 4, 8) === "ftyp") {
    const brand = ascii(b, 8, 12);
    if (/^(heic|heix|mif1|msf1|hevc)/.test(brand)) return "heic";
    return "mp4";
  }
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0])) return "doc";
  if (startsWith(b, [0x49, 0x44, 0x33]) || startsWith(b, [0xff, 0xfb]) || startsWith(b, [0xff, 0xf3])) return "mp3";
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) {
    // Conteneur ZIP : l'extension départage docx / xlsx / pptx / odt / zip
    if (["docx", "xlsx", "pptx", "odt"].includes(ext)) return ext;
    return "zip";
  }
  return null;
}

export type Upload = { fileName: string; fileType: string; size: number; data: Uint8Array<ArrayBuffer> };

/** Lit et vérifie un fichier de formulaire. `required: false` renvoie { file: null } si aucun fichier. */
export async function readUpload(
  fd: FormData,
  { key = "file", kind = "document", required = true }: { key?: string; kind?: UploadKind | "resource" | "assignment"; required?: boolean } = {},
): Promise<{ error: string } | { file: Upload | null }> {
  const f = fd.get(key);
  if (!(f instanceof File) || f.size === 0) return required ? { error: "Choisissez un fichier." } : { file: null };
  if (f.size > MAX_UPLOAD_BYTES) return { error: `Fichier trop volumineux (${MAX_UPLOAD_MB} Mo maximum).` };
  const data = new Uint8Array(await f.arrayBuffer());
  const type = sniffType(data, f.name);
  const allowed = EXT_BY_KIND[kind];
  if (!type || !allowed.includes(type)) {
    return { error: `Format non accepté (${allowed.map((e) => e.toUpperCase()).join(", ")}).` };
  }
  const safeName = f.name.replace(/[\u0000-\u001f\\/:*?"<>|]+/g, "_").slice(0, 180) || `fichier.${type}`;
  return { file: { fileName: safeName, fileType: DOC_TYPES[type], size: f.size, data } };
}

/** En-têtes de téléchargement sûrs : aperçu en ligne uniquement pour PDF et images, jamais d'exécution. */
export function fileResponseHeaders(fileName: string, fileType: string, inline = false): Record<string, string> {
  const previewable = fileType === "application/pdf" || /^image\/(jpeg|png|webp)$/.test(fileType);
  const asInline = inline && previewable;
  return {
    "Content-Type": asInline ? fileType : "application/octet-stream",
    "Content-Disposition": `${asInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "X-Content-Type-Options": "nosniff",
    // Le lecteur PDF du navigateur ne fonctionne pas dans un document « sandbox » : politique stricte pour le reste
    "Content-Security-Policy": asInline && fileType === "application/pdf" ? "default-src 'none'; object-src 'self'" : "sandbox; default-src 'none'; img-src 'self' data:",
    "Cache-Control": "private, no-store",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}
