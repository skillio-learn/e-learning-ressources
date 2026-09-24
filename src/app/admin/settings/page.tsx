import { getSettings } from "@/lib/settings";
import { saveSettingsAction } from "@/app/actions/admin";
import { StateForm } from "@/components/StateForm";
import { Field, PageHeader } from "@/components/ui";

export const metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

export default async function Settings() {
  const s = await getSettings();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Paramètres de la plateforme" />
      <div className="card p-6">
        <StateForm action={saveSettingsAction}>
          <Field label="Nom de la plateforme"><input name="platformName" defaultValue={s.platformName} className="input" /></Field>
          <Field label="Accroche (page d'accueil)"><input name="tagline" defaultValue={s.tagline} className="input" /></Field>
          <Field label="Email de support"><input name="supportEmail" type="email" defaultValue={s.supportEmail} className="input" /></Field>
          <Field label="Signature des certificats"><input name="certificateSignature" defaultValue={s.certificateSignature} className="input" /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allowRegistration" defaultChecked={s.allowRegistration === "true"} className="accent-brand-600" />
            Autoriser l&apos;inscription libre des apprenants
          </label>
        </StateForm>
      </div>
    </div>
  );
}
