import { loadTraceForViewer } from "@/lib/document-access";
import { DocShell, Signature } from "@/components/documents/DocShell";
import { EXIT_REASONS, formatHours, MODALITY_LABELS } from "@/lib/labels";
import { formatDate, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Attestation d'assiduité" };

export default async function Assiduite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trace } = await loadTraceForViewer(id, "assiduite");
  const e = trace.enrollment;
  const org = e.course.organization;
  const rate = e.plannedHours ? Math.min(100, (trace.totalSeconds / 3600 / e.plannedHours) * 100) : null;
  return (
    <DocShell org={org} title="Attestation d'assiduité">
      <p>
        Je soussigné(e), <b>{org.managerName || "le représentant de l'organisme"}</b>
        {org.managerTitle ? `, ${org.managerTitle}` : ""} de <b>{org.legalName || org.name}</b>, atteste que :
      </p>
      <p className="my-4 text-center text-lg font-semibold">
        {e.user.profile?.civility} {e.user.profile?.firstName ?? ""} {e.user.profile?.lastName ?? e.user.name}
        {e.user.profile?.birthDate && <span className="block text-sm font-normal">né(e) le {formatDate(e.user.profile.birthDate)}{e.user.profile.birthPlace ? ` à ${e.user.profile.birthPlace}` : ""}</span>}
      </p>
      <p>
        a suivi la formation <b>« {e.course.title} »</b> ({MODALITY_LABELS[e.course.modality]}), du <b>{formatDate(e.startDate ?? e.enrolledAt)}</b>
        {" "}au <b>{formatDate(e.endDate ?? trace.lastActivity)}</b>.
      </p>
      <table className="my-6 w-full border-collapse text-sm">
        <tbody>
          <tr><td className="border px-3 py-2 text-slate-600">Durée prévue</td><td className="border px-3 py-2 font-medium">{e.plannedHours ? `${e.plannedHours} heures` : "—"}</td></tr>
          <tr><td className="border px-3 py-2 text-slate-600">Temps de formation réalisé (mesuré)</td><td className="border px-3 py-2 font-medium">{formatHours(trace.totalSeconds)}</td></tr>
          <tr><td className="border px-3 py-2 text-slate-600">Taux d&apos;assiduité</td><td className="border px-3 py-2 font-medium">{rate === null ? "—" : pct(rate)}</td></tr>
          <tr><td className="border px-3 py-2 text-slate-600">Jours d&apos;activité</td><td className="border px-3 py-2">{trace.days.length} (première activité le {formatDate(trace.firstActivity)}, dernière le {formatDate(trace.lastActivity)})</td></tr>
          <tr><td className="border px-3 py-2 text-slate-600">Progression pédagogique</td><td className="border px-3 py-2">{trace.completedSteps}/{trace.totalSteps} étapes validées ({trace.percent} %)</td></tr>
          <tr><td className="border px-3 py-2 text-slate-600">Résultats aux évaluations</td><td className="border px-3 py-2">{trace.results.average === null ? "—" : `Moyenne ${pct(trace.results.average)}`}</td></tr>
                    {e.exitDate && (
            <tr><td className="border px-3 py-2 text-slate-600">Sortie anticipée</td><td className="border px-3 py-2">le {formatDate(e.exitDate)} – {EXIT_REASONS[e.exitCategory ?? ""] ?? e.exitCategory}</td></tr>
          )}
          {trace.messages.length > 0 && (
            <tr><td className="border px-3 py-2 text-slate-600">Échanges pédagogiques</td><td className="border px-3 py-2">{trace.messages.length} message(s) avec le formateur</td></tr>
          )}
          {trace.signatures.length > 0 && <tr><td className="border px-3 py-2 text-slate-600">Émargements</td><td className="border px-3 py-2">{trace.signatures.length} créneau(x) signé(s)</td></tr>}
        </tbody>
      </table>
      <p className="text-xs text-slate-500">
        Les temps sont issus de la traçabilité de la plateforme (relevé de connexions détaillé disponible sur demande). Attestation délivrée pour
        servir et valoir ce que de droit.
      </p>
      <Signature org={org} />
    </DocShell>
  );
}
