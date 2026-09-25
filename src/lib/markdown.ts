import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export function renderMarkdown(md: string | null | undefined) {
  if (!md) return "";
  const html = marked.parse(md, { async: false, gfm: true, breaks: true }) as string;
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "iframe", "details", "summary", "u", "mark"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "title", "width", "height"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "title"],
      // Classes limitées à la coloration du code (pas de classes d'interface pour habiller une fausse page)
      code: ["class"],
    },
    allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "docs.google.com", "www.canva.com"],
    allowedClasses: { code: [/^language-[\w-]+$/] },
    transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }) },
  });
}
