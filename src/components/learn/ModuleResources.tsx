import { Download, ExternalLink, FolderOpen } from "lucide-react";

type R = { id: string; title: string; description: string | null; url: string | null; fileName: string | null; size: number | null };

const size = (n: number | null) => (n ? (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`) : "");

/** Ressources du module en cours, affichées directement dans l'étape. */
export function ModuleResources({ moduleTitle, resources, allHref }: { moduleTitle: string; resources: R[]; allHref: string }) {
  if (!resources.length) return null;
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-brand-50 px-5 py-3">
        <h2 className="flex items-center gap-2 text-base">
          <FolderOpen className="h-5 w-5 text-brand-600" strokeWidth={1.75} /> Ressources du module · {moduleTitle}
        </h2>
        <a href={allHref} className="link text-sm">Toutes les ressources</a>
      </div>
      <ul className="divide-y divide-slate-100">
        {resources.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-900">{r.title}</div>
              <div className="text-xs text-slate-500">{r.description ?? (r.url ? "Lien externe" : `${r.fileName} · ${size(r.size)}`)}</div>
            </div>
            <a href={`/api/resources/${r.id}`} target={r.url ? "_blank" : undefined} rel="noopener noreferrer" className="btn-secondary btn-sm">
              {r.url ? <><ExternalLink className="h-4 w-4" strokeWidth={1.75} /> Ouvrir</> : <><Download className="h-4 w-4" strokeWidth={1.75} /> Télécharger</>}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
