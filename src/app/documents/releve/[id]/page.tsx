import { loadTraceForViewer } from "@/lib/document-access";
import { DocShell } from "@/components/documents/DocShell";
import { formatDuration, formatHours, MODALITY_LABELS } from "@/lib/labels";
import { LESSON_TYPE_LABELS, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relevé de connexions" };

const EVT = { LOGIN: "Connexion", LOGOUT: "Déconnexion", FAILED: "Échec", LOCKED: "Verrouillé" } as const;
const time = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default async function Releve({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trace } = await loadTraceForViewer(id, "releve");
  const e = trace.enrollment;
  const org = e.course.organization;
  return (
    <DocShell org={org} title="Relevé de connexions et de temps de formation" subtitle="Traçabilité de la formation à distance (FOAD) – art. D.6313-3-1 du Code du travail">
      <table className="mb-6 w-full text-sm">
        <tbody>
          <tr><td className="w-56 py-0.5 text-slate-500">Stagiaire</td><td className="font-medium">{e.user.profile?.civility} {e.user.name} ({e.user.email})</td></tr>
          <tr><td className="py-0.5 text-slate-500">Formation</td><td className="font-medium">{e.course.title}{e.course.rncpCode ? ` – ${e.course.rncpCode}` : ""}</td></tr>
          <tr><td className="py-0.5 text-slate-500">Modalité</td><td>{MODALITY_LABELS[e.course.modality]}</td></tr>
          <tr><td className="py-0.5 text-slate-500">Période</td><td>du {formatDate(e.startDate ?? e.enrolledAt)} au {formatDate(e.endDate)}</td></tr>
          {e.application && <tr><td className="py-0.5 text-slate-500">Dossier</td><td>{e.application.number}{e.fundingReference ? ` · prise en charge ${e.fundingReference}` : ""}</td></tr>}
          <tr><td className="py-0.5 text-slate-500">Temps actif total sur la formation</td><td className="font-bold">{formatHours(trace.totalSeconds)} ({formatDuration(trace.totalSeconds)}){e.plannedHours ? ` / ${e.plannedHours} h prévues` : ""}</td></tr>
          <tr><td className="py-0.5 text-slate-500">Progression</td><td>{trace.completedSteps}/{trace.totalSteps} étapes ({trace.percent} %)</td></tr>
        </tbody>
      </table>
      <p className="mb-4 rounded bg-slate-50 p-2 text-xs text-slate-600">
        Méthode de mesure : le temps est enregistré automatiquement par la plateforme par signaux d&apos;activité toutes les 30 secondes,
        uniquement lorsque la page de formation est affichée et que le stagiaire est actif. Les périodes d&apos;inactivité au-delà de{" "}
        {org.inactivityTimeoutMin} minutes sont exclues.
      </p>

      <h2 className="mb-2 mt-6 text-base font-semibold">1. Temps de formation par jour</h2>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100">
            <th className="border px-2 py-1 text-left">Date</th><th className="border px-2 py-1">Début</th><th className="border px-2 py-1">Fin</th>
            <th className="border px-2 py-1">Temps actif</th><th className="border px-2 py-1 text-left">Contenus consultés</th>
          </tr>
        </thead>
        <tbody>
          {trace.days.map((d) => (
            <tr key={d.day}>
              <td className="border px-2 py-1">{formatDate(d.firstAt)}</td>
              <td className="border px-2 py-1 text-center">{time(d.firstAt)}</td>
              <td className="border px-2 py-1 text-center">{time(d.lastAt)}</td>
              <td className="border px-2 py-1 text-center font-medium">{formatDuration(d.seconds)}</td>
              <td className="border px-2 py-1">{d.lessons.join(" · ")}</td>
            </tr>
          ))}
          {trace.days.length === 0 && <tr><td colSpan={5} className="border px-2 py-2 text-center text-slate-400">Aucune activité enregistrée</td></tr>}
          <tr className="bg-slate-50 font-semibold">
            <td className="border px-2 py-1" colSpan={3}>Total</td>
            <td className="border px-2 py-1 text-center">{formatDuration(trace.totalSeconds)}</td>
            <td className="border px-2 py-1">{trace.days.length} jour(s) d&apos;activité</td>
          </tr>
        </tbody>
      </table>

      <h2 className="mb-2 mt-6 text-base font-semibold">2. Temps et validation par étape</h2>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100">
            <th className="border px-2 py-1 text-left">Étape</th><th className="border px-2 py-1">Type</th><th className="border px-2 py-1">Temps</th>
            <th className="border px-2 py-1">Terminée le</th><th className="border px-2 py-1">Score</th>
          </tr>
        </thead>
        <tbody>
          {trace.lessons.map((l, i) => (
            <tr key={l.id}>
              <td className="border px-2 py-1">{i + 1}. {l.title}</td>
              <td className="border px-2 py-1 text-center">{LESSON_TYPE_LABELS[l.type]}</td>
              <td className="border px-2 py-1 text-center">{formatDuration(l.seconds)}</td>
              <td className="border px-2 py-1 text-center">{l.completed ? formatDate(l.completedAt, true) : "—"}</td>
              <td className="border px-2 py-1 text-center">{l.score != null ? `${Math.round(l.score)} %` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 mt-6 text-base font-semibold">3. Journal des connexions à la plateforme</h2>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100"><th className="border px-2 py-1 text-left">Date et heure</th><th className="border px-2 py-1">Évènement</th><th className="border px-2 py-1">Adresse IP</th></tr>
        </thead>
        <tbody>
          {trace.logins.map((l) => (
            <tr key={l.id}>
              <td className="border px-2 py-1">{formatDate(l.createdAt, true)}</td>
              <td className="border px-2 py-1 text-center">{EVT[l.type]}</td>
              <td className="border px-2 py-1 text-center">{l.ip ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 mt-6 text-base font-semibold">4. Sessions de travail</h2>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100"><th className="border px-2 py-1 text-left">Début</th><th className="border px-2 py-1">Fin</th><th className="border px-2 py-1">Temps actif (toute la plateforme)</th><th className="border px-2 py-1">IP</th></tr>
        </thead>
        <tbody>
          {trace.sessions.map((s) => (
            <tr key={s.id}>
              <td className="border px-2 py-1">{formatDate(s.startedAt, true)}</td>
              <td className="border px-2 py-1 text-center">{formatDate(s.endedAt ?? s.lastSeenAt, true)}</td>
              <td className="border px-2 py-1 text-center">{formatDuration(s.activeSeconds)}</td>
              <td className="border px-2 py-1 text-center">{s.ip ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {trace.signatures.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-base font-semibold">5. Émargements</h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100"><th className="border px-2 py-1 text-left">Créneau</th><th className="border px-2 py-1">Signé le</th><th className="border px-2 py-1">Signature</th></tr>
            </thead>
            <tbody>
              {trace.signatures.map((s) => (
                <tr key={s.id}>
                  <td className="border px-2 py-1">{formatDate(s.slot.date)} – {s.slot.label} ({s.slot.startTime}-{s.slot.endTime})</td>
                  <td className="border px-2 py-1 text-center">{formatDate(s.signedAt, true)} · IP {s.ip ?? "—"}</td>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <td className="border px-2 py-1 text-center"><img src={s.signature} alt="signature" className="mx-auto h-8" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </DocShell>
  );
}
