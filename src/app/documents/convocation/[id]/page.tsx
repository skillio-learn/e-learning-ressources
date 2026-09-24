import { loadEnrollmentForViewer } from "@/lib/document-access";
import { DocShell, Signature } from "@/components/documents/DocShell";
import { appUrl } from "@/lib/email";
import { MODALITY_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Convocation" };

export default async function Convocation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { enrollment: e } = await loadEnrollmentForViewer(id, "convocation");
  const org = e.course.organization;
  const p = e.user.profile;
  return (
    <DocShell org={org} title="Convocation à la formation">
      <p className="text-right text-sm">
        {p?.civility} {p?.firstName} {p?.lastName ?? e.user.name}<br />
        {p?.address}<br />
        {p?.postalCode} {p?.city}
      </p>
      <p className="mt-6">{p?.civility === "Mme" ? "Madame" : p?.civility === "M." ? "Monsieur" : "Madame, Monsieur"},</p>
      <p className="mt-3">
        Nous avons le plaisir de vous confirmer votre inscription à la formation <b>« {e.course.title} »</b>
        {e.application ? ` (dossier ${e.application.number})` : ""}. Vous êtes convoqué(e) selon les modalités suivantes :
      </p>
      <table className="my-5 w-full border-collapse text-sm">
        <tbody>
          <tr><td className="w-48 border px-3 py-2 text-slate-600">Dates</td><td className="border px-3 py-2 font-medium">du {formatDate(e.startDate)} au {formatDate(e.endDate)}</td></tr>
          <tr><td className="border px-3 py-2 text-slate-600">Durée</td><td className="border px-3 py-2">{e.plannedHours ?? e.course.durationHours ?? "—"} heures</td></tr>
          <tr><td className="border px-3 py-2 text-slate-600">Modalité</td><td className="border px-3 py-2">{MODALITY_LABELS[e.course.modality]}{e.session?.location ? ` – ${e.session.location}` : ""}</td></tr>
          <tr><td className="border px-3 py-2 text-slate-600">Session</td><td className="border px-3 py-2">{e.session?.name ?? "—"}</td></tr>
          <tr>
            <td className="border px-3 py-2 text-slate-600">Accès</td>
            <td className="border px-3 py-2">
              Plateforme : <b>{appUrl()}</b> — identifiant : <b>{e.user.email}</b>. Parcours accessible 24 h/24 sur ordinateur, tablette ou smartphone.
            </td>
          </tr>
          <tr><td className="border px-3 py-2 text-slate-600">Matériel</td><td className="border px-3 py-2">Ordinateur ou smartphone récent avec connexion Internet, navigateur à jour, écouteurs.</td></tr>
          <tr>
            <td className="border px-3 py-2 text-slate-600">Assiduité</td>
            <td className="border px-3 py-2">
              Votre temps de connexion et votre progression sont enregistrés. Pour les classes virtuelles ou le présentiel, l&apos;émargement se fait en ligne (« Émargement »).
            </td>
          </tr>
          <tr><td className="border px-3 py-2 text-slate-600">Contacts</td><td className="border px-3 py-2">{org.email ?? "—"} · {org.phone ?? ""} — messagerie de la formation sur la plateforme</td></tr>
          {org.referentHandicap && <tr><td className="border px-3 py-2 text-slate-600">Référent handicap</td><td className="border px-3 py-2">{org.referentHandicap}</td></tr>}
        </tbody>
      </table>
      <p>
        Merci de prendre connaissance du règlement intérieur{org.internalRulesUrl ? ` (${org.internalRulesUrl})` : ""} et de signer votre convention / contrat de formation depuis la
        plateforme si ce n&apos;est pas déjà fait. Nous restons à votre disposition pour toute question.
      </p>
      <Signature org={org} />
    </DocShell>
  );
}
