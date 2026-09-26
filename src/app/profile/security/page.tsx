import QRCode from "qrcode";
import { ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { decryptSecret, otpauthUri } from "@/lib/totp";
import { confirmMfaSetupAction, disableMfaAction, regenerateRecoveryCodesAction, startMfaSetupAction } from "@/app/actions/mfa";
import { MfaCodeForm } from "@/components/profile/MfaForms";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Container, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Sécurité du compte" };
export const dynamic = "force-dynamic";

export default async function Security({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const user = await requireUser();
  const { required } = await searchParams;
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true, totpSecret: true, totpEnabledAt: true, totpRecoveryHashes: true } });
  const pending = !u.totpEnabledAt && !!u.totpSecret;
  let qr: string | null = null;
  let secret: string | null = null;
  if (pending) {
    secret = decryptSecret(u.totpSecret!);
    qr = await QRCode.toDataURL(otpauthUri(secret, u.email), { margin: 1, width: 220, color: { dark: "#17262D", light: "#FFFFFF" } });
  }
  return (
    <Container className="max-w-3xl">
      <PageHeader title="Sécurité du compte" subtitle="La double authentification protège votre compte même si votre mot de passe est dérobé." back={{ href: "/profile", label: "Mon profil" }} />
      {required && !u.totpEnabledAt && (
        <p className="mb-6 rounded-[10px] bg-brand-50 p-4 text-sm text-brand-700">Votre organisme exige la double authentification pour son équipe : activez-la pour accéder à votre espace.</p>
      )}
      <section className="card p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600"><ShieldCheck className="h-6 w-6" strokeWidth={1.75} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl">Double authentification</h2>
              {u.totpEnabledAt ? <Badge tone="green">Activée le {formatDate(u.totpEnabledAt)}</Badge> : <Badge>Désactivée</Badge>}
            </div>
            <p className="mt-1 text-slate-500">
              À chaque connexion, en plus du mot de passe, un code à 6 chiffres est demandé. Il est généré par une application gratuite :
              Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden…
            </p>
          </div>
        </div>

        {!u.totpEnabledAt && !pending && (
          <form action={startMfaSetupAction} className="mt-6">
            <SubmitButton className="btn-primary">Activer la double authentification</SubmitButton>
          </form>
        )}

        {pending && qr && (
          <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code à scanner avec l'application d'authentification" width={220} height={220} className="rounded-[10px] border border-slate-200" />
            <div className="space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
                <li>Ouvrez votre application d&apos;authentification et ajoutez un compte.</li>
                <li>Scannez le QR code (ou saisissez la clé ci-dessous).</li>
                <li>Saisissez le code à 6 chiffres affiché pour confirmer.</li>
              </ol>
              <p className="break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm">{secret}</p>
              <MfaCodeForm action={confirmMfaSetupAction} label="Confirmer et activer" />
            </div>
          </div>
        )}

        {u.totpEnabledAt && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <h3>Codes de secours</h3>
              <p className="mb-3 mt-1 text-sm text-slate-500">{u.totpRecoveryHashes.length} code(s) encore disponible(s).</p>
              <MfaCodeForm action={regenerateRecoveryCodesAction} label="Générer de nouveaux codes" />
            </div>
            {!user.mfaRequired && (
              <div>
                <h3>Désactiver</h3>
                <p className="mb-3 mt-1 text-sm text-slate-500">Déconseillé : votre compte ne sera plus protégé que par le mot de passe.</p>
                <MfaCodeForm action={disableMfaAction} label="Désactiver" withPassword danger />
              </div>
            )}
          </div>
        )}
      </section>
    </Container>
  );
}
