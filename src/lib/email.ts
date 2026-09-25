import "server-only";

/** URL publique de la plateforme (liens dans les emails). */
export function appUrl(path = "") {
  const base =
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";
  return base.replace(/\/$/, "") + path;
}

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Libellé du bouton d'action selon la destination du lien. */
export function ctaLabelFor(link: string) {
  const p = link.replace(/^https?:\/\/[^/]+/, "");
  if (p.startsWith("/reset-password")) return "Choisir mon mot de passe";
  if (p.startsWith("/onboarding")) return "Compléter mon dossier";
  if (p.startsWith("/enrollments")) return "Finaliser mon inscription";
  if (p.startsWith("/learn")) return "Accéder à ma formation";
  if (p.startsWith("/applications")) return "Voir mon dossier";
  if (p.startsWith("/documents")) return "Voir le document";
  if (p.startsWith("/profile")) return "Voir mon profil";
  if (p.startsWith("/support")) return "Lire la réponse";
  if (p.startsWith("/of/tickets") || p.startsWith("/admin/support")) return "Voir le ticket";
  if (p.startsWith("/of/grading")) return "Corriger";
  if (p.startsWith("/of")) return "Ouvrir l'espace OF";
  if (p.startsWith("/admin")) return "Ouvrir l'administration";
  if (p.startsWith("/login")) return "Me connecter";
  return "Ouvrir Vylia";
}

export type EmailContent = {
  /** Titre affiché en tête du message */
  title: string;
  /** Texte d'aperçu dans la boîte de réception */
  preheader?: string;
  /** Paragraphes (texte brut, retours à la ligne conservés) */
  paragraphs: string[];
  /** Liste à puces (formations, documents à fournir…) */
  items?: string[];
  itemsTitle?: string;
  cta?: { label?: string; url: string };
  /** Remarque discrète sous le bouton (validité d'un lien…) */
  note?: string;
  /** Organisme émetteur : signature et pied de page */
  orgName?: string | null;
  /** Les réponses arrivent à l'organisme (Reply-To) */
  replyable?: boolean;
};

/** Gabarit Vylia : sobre, clair, lisible sur mobile et compatible avec les principaux clients mail. */
export function renderEmail(c: EmailContent) {
  const url = c.cta ? (c.cta.url.startsWith("http") ? c.cta.url : appUrl(c.cta.url)) : null;
  const label = c.cta ? (c.cta.label ?? ctaLabelFor(c.cta.url)) : null;
  // Charte Vylia : Poppins (secours Arial) pour le texte, Lora (secours Georgia) pour les titres
  const font = "Poppins,Arial,Helvetica,sans-serif";
  const titleFont = "Lora,Georgia,'Times New Roman',serif";
  const p = (t: string) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#17262D;white-space:pre-line">${esc(t)}</p>`;
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.title)}</title></head>
<body style="margin:0;padding:0;background:#F6F8F9;-webkit-font-smoothing:antialiased">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.preheader ?? c.paragraphs[0] ?? "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8F9;padding:32px 12px;font-family:${font}">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="padding:0 8px 20px"><img src="${appUrl("/brand/email-logo.png")}" width="128" height="40" alt="Vylia" style="display:block;border:0"></td></tr>
    <tr><td style="background:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid #D6E0E3">
      <h1 style="margin:0 0 18px;font-family:${titleFont};font-size:26px;line-height:34px;font-weight:600;color:#0E4D5C">${esc(c.title)}</h1>
      ${c.paragraphs.map(p).join("")}
      ${
        c.items?.length
          ? `${c.itemsTitle ? `<p style="margin:6px 0 8px;font-size:14px;font-weight:500;color:#546770">${esc(c.itemsTitle)}</p>` : ""}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#F6F8F9;border-radius:10px;border:1px solid #D6E0E3">
        ${c.items.map((i, n) => `<tr><td style="padding:10px 16px;font-size:15px;color:#17262D;${n < c.items!.length - 1 ? "border-bottom:1px solid #D6E0E3" : ""}">${esc(i)}</td></tr>`).join("")}
      </table>`
          : ""
      }
      ${
        url
          ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px"><tr><td style="border-radius:10px;background:#0E4D5C">
        <a href="${esc(url)}" style="display:inline-block;padding:12px 24px;font-size:16px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:10px">${esc(label!)}</a>
      </td></tr></table>
      <p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#546770">Le bouton ne fonctionne pas ? Copiez ce lien : <a href="${esc(url)}" style="color:#0E4D5C;word-break:break-all">${esc(url)}</a></p>`
          : ""
      }
      ${c.note ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:#546770">${esc(c.note)}</p>` : ""}
      ${c.orgName ? `<p style="margin:26px 0 0;font-size:15px;color:#17262D">L'équipe ${esc(c.orgName)}</p>` : ""}
    </td></tr>
    <tr><td style="padding:22px 12px 0;font-size:12px;line-height:1.6;color:#546770;text-align:center">
      ${c.orgName ? `Message envoyé par ${esc(c.orgName)} via Vylia, plateforme de formation.<br>` : "Message envoyé par Vylia, plateforme de formation.<br>"}
      ${c.replyable ? "Une question ? Répondez simplement à cet email." : "Email automatique, merci de ne pas y répondre : utilisez l'assistance dans votre espace."}<br>
      <a href="${appUrl("/legal/confidentialite")}" style="color:#546770">Confidentialité</a> · <a href="${appUrl("/")}" style="color:#546770">${esc(appUrl("").replace(/^https?:\/\//, ""))}</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
  const text = [
    c.title,
    "",
    ...c.paragraphs.flatMap((t) => [t, ""]),
    ...(c.items?.length ? [...(c.itemsTitle ? [c.itemsTitle] : []), ...c.items.map((i) => `- ${i}`), ""] : []),
    ...(url ? [`${label} : ${url}`, ""] : []),
    ...(c.note ? [c.note, ""] : []),
    c.orgName ? `L'équipe ${c.orgName}` : "Vylia",
  ].join("\n");
  return { html, text };
}

export type SendOptions = { orgName?: string | null; replyTo?: string | null; tag?: string };

/** Expéditeur : « Organisme via Vylia <noreply@…> » quand le message concerne un organisme. */
function fromHeader(orgName?: string | null) {
  const base = process.env.EMAIL_FROM || "Vylia <onboarding@resend.dev>";
  if (!orgName) return base;
  const address = base.match(/<([^>]+)>/)?.[1] ?? base;
  const name = orgName.replace(/["<>\r\n]/g, "").slice(0, 60);
  return `"${name} via Vylia" <${address}>`;
}

/** Envoi via Resend (https://resend.com). Sans clé, l'envoi est ignoré : les notifications restent dans l'application. */
export async function sendTemplatedEmail(to: string, subject: string, content: EmailContent, opts: SendOptions = {}) {
  if (!emailEnabled() || !to) return false;
  const replyTo = opts.replyTo && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(opts.replyTo) ? opts.replyTo : undefined;
  const { html, text } = renderEmail({ ...content, orgName: content.orgName ?? opts.orgName, replyable: !!replyTo });
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromHeader(opts.orgName ?? content.orgName),
        to: [to],
        subject: subject.slice(0, 200),
        text,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(opts.tag ? { tags: [{ name: "category", value: opts.tag.replace(/[^a-zA-Z0-9_-]/g, "_") }] } : {}),
      }),
    });
    if (!res.ok) console.error("email failed", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("email error", e);
    return false;
  }
}

/** Email simple (notifications) : titre, message et bouton vers la page concernée. */
export async function sendEmail(to: string, subject: string, text: string, link?: string | null, opts: SendOptions = {}) {
  return sendTemplatedEmail(
    to,
    subject,
    { title: subject, paragraphs: text ? text.split(/\n{2,}/) : [], cta: link ? { url: link } : undefined },
    { tag: "notification", ...opts },
  );
}
