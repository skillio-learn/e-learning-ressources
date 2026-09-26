import type { CompanyConvention } from "@prisma/client";
import { formatDate } from "@/lib/utils";

/** Texte de la convention (figé une fois signé) et bloc de signatures. */
export function ConventionBody({ conv, text, orgSignature, orgSigner }: { conv: CompanyConvention; text: string; orgSignature: string | null; orgSigner: string }) {
  const [, , ...rest] = text.split("\n");
  return (
    <>
      <div className="space-y-1 text-[13px]">
        {rest.map((l, i) =>
          /^Article \d+ ·/.test(l) ? <h2 key={i} className="pt-3 text-sm font-bold">{l}</h2> : l === "" ? null : <p key={i}>{l}</p>,
        )}
      </div>
      <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
        <div>
          <div className="font-semibold">Pour l&apos;organisme de formation</div>
          <div className="text-xs text-slate-500">{orgSigner}</div>
          {orgSignature ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={orgSignature} alt="Signature de l'organisme" className="mt-2 h-16" />
          ) : <div className="mt-10 text-xs text-slate-500">Signature et cachet</div>}
        </div>
        <div className="text-right">
          <div className="font-semibold">Pour l&apos;entreprise</div>
          {conv.status === "SIGNED" ? (
            <>
              <div className="text-xs text-slate-500">{conv.signerName}, {conv.signerTitle} · signé électroniquement le {formatDate(conv.signedAt, true)}</div>
              {conv.signature && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={conv.signature} alt="Signature de l'entreprise" className="ml-auto mt-2 h-16" />
              )}
              <div className="mt-2 break-all text-[10px] text-slate-400">Empreinte SHA-256 : {conv.contentHash}</div>
            </>
          ) : <div className="mt-10 text-xs text-slate-500">{conv.status === "CANCELLED" ? "Convention annulée" : "En attente de signature"}</div>}
        </div>
      </div>
    </>
  );
}
