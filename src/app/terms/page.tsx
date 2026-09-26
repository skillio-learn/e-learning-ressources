import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { CGU_MARKDOWN, TERMS_VERSION } from "@/lib/terms";
import { acceptTermsAction } from "@/app/actions/terms";
import { SubmitButton } from "@/components/SubmitButton";
import { Container, PageHeader } from "@/components/ui";

export const metadata = { title: "Conditions générales d'utilisation" };
export const dynamic = "force-dynamic";

/** Acceptation de la version en vigueur des CGU (première connexion et à chaque nouvelle version). */
export default async function Terms({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { next } = await searchParams;
  const updated = !!user.termsAcceptedVersion && user.termsAcceptedVersion !== TERMS_VERSION;
  return (
    <Container className="max-w-3xl">
      <PageHeader
        title="Conditions générales d'utilisation"
        subtitle={updated ? "Nos conditions ont évolué : merci de prendre connaissance de la nouvelle version." : "Avant de commencer, merci de prendre connaissance des conditions d'utilisation de la plateforme."}
      />
      <article className="card prose-lms max-h-[55vh] overflow-y-auto p-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(CGU_MARKDOWN) }} />
      <form action={acceptTermsAction} className="card mt-6 space-y-4 p-6">
        <input type="hidden" name="next" value={next ?? ""} />
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="accept" required className="mt-1 h-4 w-4" />
          <span>
            J&apos;ai lu et j&apos;accepte les conditions générales d&apos;utilisation (version {TERMS_VERSION}) et la{" "}
            <a href="/legal/confidentialite" target="_blank" className="link">politique de confidentialité</a>.
          </span>
        </label>
        <SubmitButton className="btn-primary">Accepter et continuer</SubmitButton>
      </form>
    </Container>
  );
}
