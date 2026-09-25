import { loadTraceForViewer } from "@/lib/document-access";
import { DocShell, Signature } from "@/components/documents/DocShell";
import { EXIT_REASONS, formatHours } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificat de réalisation" };

/** Modèle conforme au certificat de réalisation (arrêté du ministère du Travail) – CPF, OPCO, France Travail. */
export default async function Realisation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trace } = await loadTraceForViewer(id, "realisation", { learnerRequiresFinished: true });
  const e = trace.enrollment;
  const org = e.course.organization;
  const hours = Math.round((trace.totalSeconds / 3600) * 100) / 100;
  const Box = ({ checked }: { checked: boolean }) => <span className="mr-1 inline-block w-4 text-center">{checked ? "☒" : "☐"}</span>;
  return (
    <DocShell org={org} title="Certificat de réalisation">
      <p>
        Je soussigné(e) <b>{org.managerName || "…………………………"}</b>, représentant légal du dispensateur de l&apos;action concourant au
        développement des compétences <b>{org.legalName || org.name}</b>
        {org.nda ? ` (déclaration d'activité n° ${org.nda})` : ""},
      </p>
      <p className="mt-3">atteste que :</p>
      <p className="my-3 text-center text-lg font-semibold">
        {e.user.profile?.civility} {e.user.profile?.firstName ?? ""} {e.user.profile?.lastName ?? e.user.name}
      </p>
      <p>salarié(e) / bénéficiaire de l&apos;entreprise ou du dispositif : <b>{e.user.profile?.employerName || "—"}</b></p>
      <p className="mt-3">a suivi l&apos;action : <b>{e.course.title}</b>{e.course.rncpCode ? ` (${e.course.rncpCode})` : ""}</p>
      <p className="mt-3">Nature de l&apos;action concourant au développement des compétences :</p>
      <ul className="ml-4 mt-1 space-y-0.5">
        <li><Box checked /> action de formation</li>
        <li><Box checked={false} /> bilan de compétences</li>
        <li><Box checked={false} /> action de VAE</li>
        <li><Box checked={false} /> action de formation par apprentissage</li>
      </ul>
      <p className="mt-4">
        qui s&apos;est déroulée du <b>{formatDate(e.startDate ?? trace.firstActivity ?? e.enrolledAt)}</b> au{" "}
        <b>{formatDate(e.exitDate ?? e.completedAt ?? e.endDate ?? trace.lastActivity)}</b>
        {e.plannedHours ? <> pour une durée prévue de <b>{e.plannedHours} heures</b></> : null}.
      </p>
      <p className="mt-3">
        Durée réalisée : <b>{hours.toLocaleString("fr-FR")} heures</b> ({formatHours(trace.totalSeconds)}),{" "}
        {e.course.modality === "FOAD" ? "à distance (FOAD), temps mesuré par la plateforme" : "selon les feuilles d'émargement et le temps mesuré en ligne"}.
      </p>
            {e.exitDate && (
        <p className="mt-3 rounded bg-slate-50 p-2">
          Le stagiaire a interrompu la formation le <b>{formatDate(e.exitDate)}</b> (motif : {EXIT_REASONS[e.exitCategory ?? ""] ?? e.exitCategory}). La durée réalisée ci-dessus
          correspond aux heures effectivement suivies avant cette date.
        </p>
      )}
      {e.fundingReference && <p className="mt-3">Référence du dossier de financement : <b>{e.fundingReference}</b></p>}
      <p className="mt-6 text-xs text-slate-500">
        Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m&apos;engage à conserver l&apos;ensemble des
        pièces justificatives qui ont permis d&apos;établir le présent certificat pendant une durée de 3 ans à compter de la fin de l&apos;année
        du dernier paiement. En cas de cofinancement des fonds européens, la durée de conservation est étendue conformément aux obligations
        conventionnelles spécifiques.
      </p>
      <Signature org={org} />
    </DocShell>
  );
}
