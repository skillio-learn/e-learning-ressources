import { getSettings } from "@/lib/settings";
import { saveSettingsAction } from "@/app/actions/admin";
import { StateForm } from "@/components/StateForm";
import { Field, PageHeader } from "@/components/ui";

export const metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

export default async function Settings() {
  const s = await getSettings();
  return (
    <div className="max-w-4xl">
      <PageHeader title="Paramètres de la plateforme" />
      <div className="card p-6">
        <StateForm action={saveSettingsAction}>
          <Field label="Nom de la plateforme"><input name="platformName" defaultValue={s.platformName} className="input" /></Field>
          <Field label="Accroche (page d'accueil)"><input name="tagline" defaultValue={s.tagline} className="input" /></Field>
          <Field label="Email de support"><input name="supportEmail" type="email" defaultValue={s.supportEmail} className="input" /></Field>
          <Field label="Signature des certificats"><input name="certificateSignature" defaultValue={s.certificateSignature} className="input" /></Field>
          <Field label="Mentions légales (Markdown)"><textarea name="legalMentions" rows={8} defaultValue={s.legalMentions} className="input font-mono text-xs" /></Field>
          <Field label="Conditions générales d'utilisation (Markdown)"><textarea name="cgu" rows={8} defaultValue={s.cgu} className="input font-mono text-xs" /></Field>
          <Field label="Politique de confidentialité / RGPD (Markdown)"><textarea name="privacy" rows={10} defaultValue={s.privacy} className="input font-mono text-xs" /></Field>
          <Field label="Accessibilité & handicap (Markdown)"><textarea name="accessibility" rows={5} defaultValue={s.accessibility} className="input font-mono text-xs" /></Field>
        </StateForm>
      </div>
    </div>
  );
}
