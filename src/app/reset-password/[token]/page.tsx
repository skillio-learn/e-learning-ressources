import Link from "next/link";
import { resetPasswordWithTokenAction } from "@/app/actions/password";
import { StateForm } from "@/components/StateForm";
import { AuthShell } from "@/components/AuthShell";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { TERMS_VERSION } from "@/lib/terms";

export const metadata = { title: "Nouveau mot de passe" };

export default async function ResetPassword({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rec = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token.slice(0, 128)) }, select: { user: { select: { termsAcceptedVersion: true } } } });
  const needsTerms = !!rec && rec.user.termsAcceptedVersion !== TERMS_VERSION;
  return (
    <AuthShell title="Nouveau mot de passe">
        <StateForm action={resetPasswordWithTokenAction.bind(null, token)} submitLabel="Enregistrer" submitClassName="btn-primary w-full">
          <input name="password" type="password" required minLength={8} className="input" placeholder="Nouveau mot de passe" autoComplete="new-password" />
          <input name="confirm" type="password" required minLength={8} className="input" placeholder="Confirmation" autoComplete="new-password" />
          <p className="text-xs text-slate-500">8 caractères minimum, dont une lettre et un chiffre.</p>
          {needsTerms && (
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" name="acceptTerms" required className="mt-0.5 h-4 w-4" />
              <span>J&apos;accepte les <Link href="/legal/cgu" target="_blank" className="link">conditions générales d&apos;utilisation</Link> et j&apos;ai pris connaissance de la <Link href="/legal/confidentialite" target="_blank" className="link">politique de confidentialité</Link>.</span>
            </label>
          )}
        </StateForm>
        <p className="mt-6 text-center text-sm"><Link href="/login" className="link">Se connecter</Link></p>
    </AuthShell>
  );
}
