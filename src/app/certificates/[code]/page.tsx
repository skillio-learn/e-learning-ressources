import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PrintButton } from "@/components/PrintButton";
import { Logo } from "@/components/brand/Logo";
import { badgeUrls, linkedInAddUrl } from "@/lib/badges";
import { formatDate, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificat" };

/** Page publique : certificat et vérification d'authenticité (QR code, Open Badges, LinkedIn). */
export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cert = await db.certificate.findUnique({
    where: { code },
    include: {
      user: { select: { id: true, name: true } },
      course: { select: { title: true, durationHours: true, rncpCode: true, organization: { select: { name: true, legalName: true, managerName: true, managerTitle: true, signatureImage: true, logoUrl: true } } } },
    },
  });
  if (!cert) notFound();
  const viewer = await getCurrentUser();
  const own = viewer?.id === cert.user.id;
  const org = cert.course.organization;
  const verifyUrl = badgeUrls.certificate(cert.code);
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 220, color: { dark: "#17262d", light: "#ffffff" } });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="rounded-[10px] bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Certificat authentique : délivré par {org.legalName ?? org.name} le {formatDate(cert.issuedAt)} à {cert.user.name}.
        </p>
        <div className="flex flex-wrap gap-2">
          {own && (
            <a href={linkedInAddUrl({ name: cert.course.title, organizationName: org.legalName ?? org.name, issuedAt: cert.issuedAt, code: cert.code })} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              Ajouter à mon profil LinkedIn
            </a>
          )}
          <PrintButton label="Enregistrer en PDF" />
        </div>
      </div>
      <div className="theme-paper relative aspect-[1.414/1] w-full overflow-hidden rounded-2xl border border-slate-200 bg-surface p-8 text-center sm:p-12 print:rounded-none print:border-0">
        <div className="absolute inset-3 rounded-xl border-2 border-brand-600/70" aria-hidden />
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt={org.name} className="h-10" />
            ) : <span className="text-sm font-medium text-brand-600">{org.name}</span>}
            <Logo className="h-7" />
          </div>
          <div className="mt-6 font-title text-3xl text-slate-900 sm:text-5xl">Certificat de réussite</div>
          <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-ambre-500" aria-hidden />
          <div className="mt-6 text-sm text-slate-500">Ce certificat atteste que</div>
          <div className="mt-1 font-title text-2xl text-brand-700 sm:text-4xl">{cert.user.name}</div>
          <div className="mt-4 text-sm text-slate-500">a suivi et validé la formation</div>
          <div className="mx-auto mt-1 max-w-2xl text-lg font-medium text-slate-900 sm:text-2xl">{cert.course.title}</div>
          <div className="mt-3 text-xs text-slate-500 sm:text-sm">
            {cert.course.durationHours ? `Durée : ${cert.course.durationHours} h · ` : ""}
            {cert.finalScore !== null ? `Résultat : ${pct(cert.finalScore)} · ` : ""}
            {cert.course.rncpCode ? `${cert.course.rncpCode} · ` : ""}
            Délivré le {formatDate(cert.issuedAt)}
          </div>
          <div className="mt-auto flex items-end justify-between gap-4 text-left text-xs text-slate-500">
            <div>
              <div className="font-medium text-slate-700">{org.managerName ?? org.legalName ?? org.name}</div>
              <div>{org.managerTitle ?? "Pour l'organisme de formation"}</div>
              {org.signatureImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.signatureImage} alt="Signature" className="mt-1 h-10" />
              )}
            </div>
            <div className="flex items-end gap-3 text-right">
              <div>
                <div>Vérification</div>
                <div className="font-mono text-sm text-slate-700">{cert.code}</div>
                <div className="hidden sm:block">{verifyUrl.replace(/^https?:\/\//, "")}</div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code de vérification" className="h-16 w-16 sm:h-20 sm:w-20" />
            </div>
          </div>
        </div>
      </div>
      <p className="no-print mt-4 text-xs text-slate-500">
        Badge numérique au format Open Badges 2.0 :{" "}
        <a href={badgeUrls.assertion(cert.code)} className="link" target="_blank" rel="noopener">assertion vérifiable</a>. Vous pouvez l&apos;importer dans un portefeuille de badges avec ce lien.
      </p>
    </main>
  );
}
