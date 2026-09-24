import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";
import { formatDate, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificat" };

/** Page publique : sert aussi de vérification d'authenticité via le code. */
export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [cert, settings] = await Promise.all([
    db.certificate.findUnique({
      where: { code },
      include: {
        user: { select: { name: true } },
        course: { select: { title: true, durationHours: true, author: { select: { name: true } } } },
      },
    }),
    getSettings(),
  ]);
  if (!cert) notFound();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton label="🖨 Imprimer / Enregistrer en PDF" />
      </div>
      <div className="relative aspect-[1.414/1] w-full overflow-hidden rounded-2xl border-[10px] border-double border-brand-700 bg-white p-10 text-center shadow-xl print:shadow-none">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">{settings.platformName}</div>
        <div className="mt-6 text-4xl font-extrabold text-slate-900 md:text-5xl">Certificat de réussite</div>
        <div className="mt-8 text-slate-500">Ce certificat atteste que</div>
        <div className="mt-2 text-3xl font-bold text-brand-800">{cert.user.name}</div>
        <div className="mt-6 text-slate-500">a suivi et validé la formation</div>
        <div className="mx-auto mt-2 max-w-2xl text-2xl font-semibold text-slate-900">{cert.course.title}</div>
        <div className="mt-4 text-sm text-slate-500">
          {cert.course.durationHours ? `Durée : ${cert.course.durationHours} h · ` : ""}
          {cert.finalScore !== null ? `Résultat : ${pct(cert.finalScore)} · ` : ""}
          Délivré le {formatDate(cert.issuedAt)}
        </div>
        <div className="absolute bottom-10 left-10 right-10 flex items-end justify-between text-left text-xs text-slate-500">
          <div>
            <div className="font-semibold text-slate-700">{settings.certificateSignature}</div>
            <div>Formateur : {cert.course.author.name}</div>
          </div>
          <div className="text-right">
            <div>N° de vérification</div>
            <div className="font-mono text-sm text-slate-700">{cert.code}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
