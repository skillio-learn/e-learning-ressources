import { notFound } from "next/navigation";
import { Download, ExternalLink, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { getLearnContext } from "@/lib/learn";
import { startedModuleIds } from "@/lib/progress";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ressources" };

const size = (n: number | null) => (n ? (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`) : "");

/** Ressources mises à disposition par l'organisme, module par module : accessibles dès le démarrage du module. */
export default async function LearnerResources({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, course, enrollment, preview } = await getLearnContext(slug);
  if (!enrollment && !preview) notFound();
  const [modules, started] = await Promise.all([
    db.module.findMany({
      where: { courseId: course.id },
      orderBy: { position: "asc" },
      select: { id: true, title: true, position: true, resources: { orderBy: { position: "asc" }, select: { id: true, title: true, description: true, url: true, fileName: true, size: true } } },
    }),
    startedModuleIds(user.id, course.id),
  ]);
  const withResources = modules.filter((m) => m.resources.length);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 lg:px-10">
      <div>
        <h1 className="text-3xl">Ressources</h1>
        <p className="mt-2 text-slate-500">Documents, énoncés et exercices mis à disposition par votre organisme. Les ressources d&apos;un module s&apos;ouvrent dès que vous le commencez.</p>
      </div>
      {withResources.length === 0 && <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Aucune ressource pour cette formation.</p>}
      {withResources.map((m) => {
        const open = preview || started.has(m.id);
        return (
          <section key={m.id} className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
              <h2 className="text-base">Module {m.position + 1} · {m.title}</h2>
              {!open && <span className="flex items-center gap-1.5 text-xs text-slate-500"><Lock className="h-3.5 w-3.5" strokeWidth={1.75} /> Disponible au démarrage du module</span>}
            </div>
            <ul className="divide-y divide-slate-100">
              {m.resources.map((r) => (
                <li key={r.id} className={`flex flex-wrap items-center gap-3 px-5 py-3 ${open ? "" : "opacity-60"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900">{r.title}</div>
                    <div className="text-xs text-slate-500">{r.description ?? (r.url ? "Lien externe" : `${r.fileName} · ${size(r.size)}`)}</div>
                  </div>
                  {open ? (
                    <a href={`/api/resources/${r.id}`} target={r.url ? "_blank" : undefined} rel="noopener noreferrer" className="btn-secondary btn-sm">
                      {r.url ? <><ExternalLink className="h-4 w-4" strokeWidth={1.75} /> Ouvrir</> : <><Download className="h-4 w-4" strokeWidth={1.75} /> Télécharger</>}
                    </a>
                  ) : (
                    <Lock className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
