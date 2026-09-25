import type { Organization } from "@prisma/client";
import { PrintButton } from "@/components/PrintButton";
import { formatDate } from "@/lib/utils";

export function DocShell({ org, title, subtitle, children }: { org: Organization; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex justify-end gap-2">
        <PrintButton label="Imprimer / Enregistrer en PDF" />
      </div>
      <article className="theme-paper rounded-2xl border border-slate-200 p-8 text-sm leading-relaxed print:border-0 print:shadow-none">
        <header className="mb-6 flex items-start justify-between gap-6 border-b border-slate-200 pb-4">
          <div>
            {org.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="" className="mb-2 h-12" />
            )}
            <div className="text-base font-bold">{org.legalName || org.name}</div>
            <div className="text-xs text-slate-600">
              {[org.address, [org.postalCode, org.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
              <br />
              {org.siret && <>SIRET {org.siret} · </>}
              {org.nda && <>Déclaration d&apos;activité n° {org.nda}{org.ndaRegion ? ` (${org.ndaRegion})` : ""}</>}
              {org.qualiopiNumber && <><br />Certification Qualiopi n° {org.qualiopiNumber}</>}
              {(org.email || org.phone) && <><br />{org.email} {org.phone}</>}
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">Édité le {formatDate(new Date(), true)}</div>
        </header>
        <h1 className="text-center text-xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-center text-xs text-slate-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </article>
    </main>
  );
}

export function Signature({ org, place }: { org: Organization; place?: string | null }) {
  return (
    <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
      <div>
        Fait à {place || org.city || "…………"}, le {formatDate(new Date())}
      </div>
      <div className="text-right">
                <div className="font-semibold">{org.managerName || "Le responsable de l'organisme"}</div>
        <div className="text-xs text-slate-500">{org.managerTitle || "Représentant légal"}</div>
        {org.signatureImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.signatureImage} alt="Signature de l'organisme" className="ml-auto mt-2 h-16" />
        ) : (
          <div className="mt-10 text-xs text-slate-500">Signature et cachet de l&apos;organisme</div>
        )}
      </div>
    </div>
  );
}
