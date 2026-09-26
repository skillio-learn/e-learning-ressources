import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { renderMarkdown } from "@/lib/markdown";
import { CGU_MARKDOWN } from "@/lib/terms";
import { Container, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGES = {
  "mentions-legales": { key: "legalMentions", title: "Mentions légales" },
  cgu: { key: "cgu", title: "Conditions générales d'utilisation" },
  confidentialite: { key: "privacy", title: "Politique de confidentialité & RGPD" },
  accessibilite: { key: "accessibility", title: "Accessibilité & handicap" },
} as const;

export default async function Legal({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const def = PAGES[page as keyof typeof PAGES];
  if (!def) notFound();
  const s = await getSettings();
  return (
    <Container className="max-w-3xl">
      <PageHeader title={def.title} />
      <article className="card prose-lms p-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(def.key === "cgu" ? CGU_MARKDOWN : s[def.key]) }} />
    </Container>
  );
}
