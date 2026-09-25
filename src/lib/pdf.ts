import "server-only";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";

/**
 * Génération de documents PDF (attestations, relevés, résultats de quiz) côté serveur, sans navigateur.
 * Polices standard PDF (Helvetica) : le texte est ramené au jeu de caractères WinAnsi.
 */

const A4: [number, number] = [595.28, 841.89];
const M = 50; // marges
const INK = rgb(0.11, 0.11, 0.12);
const MUTED = rgb(0.43, 0.43, 0.45);
const LINE = rgb(0.87, 0.87, 0.89);
const BRAND = rgb(0, 0.443, 0.89);

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Rend une chaîne encodable en WinAnsi (espaces insécables, flèches, symboles). */
export function pdfText(input: unknown): string {
  const s = String(input ?? "")
    .replace(/[    ]/g, " ")
    .replace(/[→⇒]/g, "->")
    .replace(/[←]/g, "<-")
    .replace(/[≥]/g, ">=")
    .replace(/[≤]/g, "<=")
    .replace(/[✓✔☑☒]/g, "x")
    .replace(/[☐]/g, "o")
    .replace(/\t/g, " ")
    .replace(/\r/g, "");
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === "\n" || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WIN_ANSI_EXTRA.includes(ch)) out += ch;
    else out += "?";
  }
  return out;
}

type TextOpts = { size?: number; bold?: boolean; color?: RGB; indent?: number; lineGap?: number };
export type Column = { label: string; width: number; align?: "left" | "right" };

export class PdfBuilder {
  private doc!: PDFDocument;
  private page!: PDFPage;
  private regular!: PDFFont;
  private bold!: PDFFont;
  private y = 0;
  private footerNote = "";

  static async create(meta: { title: string; subject?: string; author?: string }) {
    const b = new PdfBuilder();
    b.doc = await PDFDocument.create();
    b.doc.setTitle(pdfText(meta.title));
    if (meta.subject) b.doc.setSubject(pdfText(meta.subject));
    b.doc.setAuthor(pdfText(meta.author ?? "Vylia"));
    b.doc.setCreator("Vylia");
    b.doc.setProducer("Vylia");
    b.doc.setCreationDate(new Date());
    b.regular = await b.doc.embedFont(StandardFonts.Helvetica);
    b.bold = await b.doc.embedFont(StandardFonts.HelveticaBold);
    b.newPage();
    return b;
  }

  get width() {
    return A4[0] - 2 * M;
  }

  setFooter(note: string) {
    this.footerNote = pdfText(note);
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - M;
  }

  private ensure(h: number) {
    if (this.y - h < M + 30) this.newPage();
  }

  private wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
    const lines: string[] = [];
    for (const para of pdfText(text).split("\n")) {
      const words = para.split(/\s+/);
      let line = "";
      for (const w of words) {
        const candidate = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
        else {
          if (line) lines.push(line);
          // Mot plus long que la ligne : découpe forcée
          let rest = w;
          while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
            let n = rest.length;
            while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), size) > maxWidth) n--;
            lines.push(rest.slice(0, n));
            rest = rest.slice(n);
          }
          line = rest;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  /** En-tête : organisme à gauche, marque Vylia à droite, puis titre du document. */
  header(orgLines: string[], title: string, subtitle?: string) {
    const top = this.y;
    orgLines.filter(Boolean).forEach((l, i) => {
      this.page.drawText(pdfText(l), { x: M, y: top - i * 12, size: i === 0 ? 11 : 8.5, font: i === 0 ? this.bold : this.regular, color: i === 0 ? INK : MUTED });
    });
    this.page.drawText("Vylia", { x: A4[0] - M - this.bold.widthOfTextAtSize("Vylia", 11), y: top, size: 11, font: this.bold, color: BRAND });
    this.y = top - Math.max(orgLines.filter(Boolean).length, 1) * 12 - 22;
    this.page.drawLine({ start: { x: M, y: this.y + 10 }, end: { x: A4[0] - M, y: this.y + 10 }, thickness: 0.6, color: LINE });
    this.y -= 14;
    this.text(title, { size: 18, bold: true });
    if (subtitle) this.text(subtitle, { size: 10, color: MUTED });
    this.space(8);
  }

  text(text: string, o: TextOpts = {}) {
    const size = o.size ?? 10;
    const font = o.bold ? this.bold : this.regular;
    const indent = o.indent ?? 0;
    const lh = size * 1.35 + (o.lineGap ?? 0);
    for (const line of this.wrap(text, font, size, this.width - indent)) {
      this.ensure(lh);
      this.page.drawText(line, { x: M + indent, y: this.y - size, size, font, color: o.color ?? INK });
      this.y -= lh;
    }
  }

  heading(text: string) {
    this.space(6);
    this.ensure(28);
    this.text(text, { size: 12, bold: true });
    this.space(2);
  }

  space(h = 8) {
    this.y -= h;
  }

  /** Paires libellé / valeur sur deux colonnes. */
  keyValues(rows: [string, string | number | null | undefined][]) {
    const labelW = 170;
    for (const [k, v] of rows) {
      const val = v === null || v === undefined || v === "" ? "-" : String(v);
      const lines = this.wrap(val, this.regular, 9.5, this.width - labelW);
      const h = lines.length * 13 + 2;
      this.ensure(h);
      this.page.drawText(pdfText(k), { x: M, y: this.y - 9.5, size: 9.5, font: this.regular, color: MUTED });
      lines.forEach((l, i) => this.page.drawText(l, { x: M + labelW, y: this.y - 9.5 - i * 13, size: 9.5, font: this.bold, color: INK }));
      this.y -= h;
    }
  }

  /** Tableau avec en-tête répété à chaque page. */
  table(cols: Column[], rows: (string | number | null | undefined)[][], size = 8.5) {
    const total = cols.reduce((s, c) => s + c.width, 0);
    const scale = this.width / total;
    const widths = cols.map((c) => c.width * scale);
    const drawHeader = () => {
      this.ensure(20);
      let x = M;
      this.page.drawRectangle({ x: M, y: this.y - 15, width: this.width, height: 15, color: rgb(0.96, 0.96, 0.97) });
      cols.forEach((c, i) => {
        this.page.drawText(pdfText(c.label), { x: x + 4, y: this.y - 11, size: size, font: this.bold, color: INK });
        x += widths[i];
      });
      this.y -= 17;
    };
    drawHeader();
    for (const r of rows) {
      const cells = r.map((v, i) => this.wrap(v === null || v === undefined ? "" : String(v), this.regular, size, widths[i] - 8));
      const h = Math.max(...cells.map((c) => c.length)) * (size * 1.3) + 5;
      if (this.y - h < M + 30) {
        this.newPage();
        drawHeader();
      }
      let x = M;
      cells.forEach((lines, i) => {
        lines.forEach((l, j) => {
          const w = this.regular.widthOfTextAtSize(l, size);
          const tx = cols[i].align === "right" ? x + widths[i] - 4 - w : x + 4;
          this.page.drawText(l, { x: tx, y: this.y - size - 1 - j * size * 1.3, size, font: this.regular, color: INK });
        });
        x += widths[i];
      });
      this.y -= h;
      this.page.drawLine({ start: { x: M, y: this.y + 1 }, end: { x: A4[0] - M, y: this.y + 1 }, thickness: 0.4, color: LINE });
    }
    this.space(6);
  }

  /** Image PNG/JPEG en data URL (signature). */
  async image(dataUrl: string | null | undefined, maxW: number, maxH: number, align: "left" | "right" = "left") {
    if (!dataUrl) return;
    const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/);
    if (!m) return;
    try {
      const bytes = Buffer.from(m[2], "base64");
      const img = m[1] === "png" ? await this.doc.embedPng(bytes) : await this.doc.embedJpg(bytes);
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * ratio;
      const h = img.height * ratio;
      this.ensure(h + 4);
      this.page.drawImage(img, { x: align === "right" ? A4[0] - M - w : M, y: this.y - h, width: w, height: h });
      this.y -= h + 4;
    } catch {
      // Signature illisible : ignorée
    }
  }

  /** Bloc de signature de l'organisme (à droite). */
  async signature(place: string, name: string, title: string, image?: string | null) {
    this.space(18);
    this.ensure(110);
    const startY = this.y;
    this.page.drawText(pdfText(place), { x: M, y: this.y - 10, size: 10, font: this.regular, color: INK });
    const rightX = A4[0] - M - 200;
    this.page.drawText(pdfText(name), { x: rightX, y: this.y - 10, size: 10, font: this.bold, color: INK });
    this.page.drawText(pdfText(title), { x: rightX, y: this.y - 23, size: 8.5, font: this.regular, color: MUTED });
    this.y -= 30;
    if (image) await this.image(image, 160, 60, "right");
    else {
      this.page.drawText("Signature et cachet de l'organisme", { x: rightX, y: this.y - 40, size: 8, font: this.regular, color: MUTED });
      this.y -= 50;
    }
    this.y = Math.min(this.y, startY - 90);
  }

  async save() {
    const pages = this.doc.getPages();
    const stamp = pdfText(`Document généré par Vylia le ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`);
    pages.forEach((p, i) => {
      const label = `Page ${i + 1} / ${pages.length}`;
      p.drawText(stamp + (this.footerNote ? ` · ${this.footerNote}` : ""), { x: M, y: 28, size: 7, font: this.regular, color: MUTED, maxWidth: this.width - 60 });
      p.drawText(label, { x: A4[0] - M - this.regular.widthOfTextAtSize(label, 7), y: 28, size: 7, font: this.regular, color: MUTED });
    });
    return this.doc.save();
  }
}

export function pdfResponse(bytes: Uint8Array, fileName: string, inline = false) {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

export const pdfSlug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "document";
