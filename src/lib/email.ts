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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Envoi d'email transactionnel via Resend (https://resend.com).
 * Variables : RESEND_API_KEY, EMAIL_FROM (ex. « Skillio <notifications@votre-domaine.fr> »).
 * Sans clé, l'envoi est ignoré (les notifications restent disponibles dans l'application).
 */
export async function sendEmail(to: string, subject: string, text: string, link?: string | null) {
  if (!emailEnabled() || !to) return false;
  const url = link ? (link.startsWith("http") ? link : appUrl(link)) : null;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1e293b">
    <h2 style="color:#2547ea">${escapeHtml(subject)}</h2>
    <p style="white-space:pre-line;line-height:1.5">${escapeHtml(text)}</p>
    ${url ? `<p><a href="${url}" style="display:inline-block;background:#2547ea;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Ouvrir la plateforme</a></p>` : ""}
    <p style="font-size:12px;color:#64748b">Message automatique — merci de ne pas répondre directement.</p></div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Skillio <onboarding@resend.dev>",
        to: [to],
        subject,
        text: url ? `${text}\n\n${url}` : text,
        html,
      }),
    });
    if (!res.ok) console.error("email failed", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("email error", e);
    return false;
  }
}
