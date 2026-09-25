import { loadEnrollmentForViewer } from "@/lib/document-access";
import { signConventionAction } from "@/app/actions/compliance";
import { DocShell } from "@/components/documents/DocShell";
import { SignaturePad } from "@/components/SignaturePad";
import { appUrl } from "@/lib/email";
import { FUNDING_TYPES, MODALITY_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Convention de formation" };

/**
 * Convention (financement par un tiers : OPCO, employeur, France Travail, Région…) — art. L.6353-1 et D.6353-1 C. trav.
 * Contrat de formation professionnelle (personne physique finançant tout ou partie) — art. L.6353-3 à L.6353-7 C. trav.
 */
export default async function Convention({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { enrollment: e, isLearner } = await loadEnrollmentForViewer(id, "convention");
  const org = e.course.organization;
  const p = e.user.profile;
  const isContract = !e.fundingType || e.fundingType === "PERSONAL" || e.fundingType === "CPF";
  const hasEmployer = (e.fundingType === "OPCO" || e.fundingType === "EMPLOYER") && p?.employerName;
  const hours = e.plannedHours ?? e.course.durationHours;
  const learnerName = `${p?.civility ?? ""} ${p?.firstName ?? ""} ${p?.lastName ?? e.user.name}`.trim();
  const A = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
    <section className="mt-4">
      <h2 className="text-sm font-bold">Article {n} – {title}</h2>
      <div className="mt-1 space-y-1 text-[13px]">{children}</div>
    </section>
  );
  let n = 0;
  return (
    <DocShell
      org={org}
      title={isContract ? "Contrat de formation professionnelle" : "Convention de formation professionnelle"}
      subtitle={isContract ? "Articles L.6353-3 à L.6353-7 du Code du travail" : "Articles L.6353-1 et D.6353-1 du Code du travail"}
    >
      <p className="text-[13px]"><b>Entre les soussignés :</b></p>
      <p className="text-[13px]">
        <b>{org.legalName || org.name}</b>, {[org.address, org.postalCode, org.city].filter(Boolean).join(" ")}, SIRET {org.siret ?? "…"}, déclaration d&apos;activité
        n° {org.nda ?? "…"} {org.ndaRegion ? `auprès du préfet de région ${org.ndaRegion}` : ""} (cet enregistrement ne vaut pas agrément de l&apos;État), représenté par{" "}
        {org.managerName ?? "son représentant légal"}, ci-après « l&apos;organisme de formation » ;
      </p>
      {hasEmployer && (
        <p className="text-[13px]">
          <b>{p?.employerName}</b>, SIRET {p?.employerSiret ?? "…"}, {p?.employerAddress ?? ""}, représenté par {p?.employerContactName ?? "son représentant"}, ci-après « l&apos;entreprise » ;
        </p>
      )}
      <p className="text-[13px]">
        et <b>{learnerName}</b>, né(e) le {formatDate(p?.birthDate)}{p?.birthPlace ? ` à ${p.birthPlace}` : ""}, demeurant {[p?.address, p?.postalCode, p?.city].filter(Boolean).join(" ") || "…"},
        ci-après « le stagiaire ».
      </p>

      <A n={++n} title="Objet">
        <p>
          L&apos;organisme de formation s&apos;engage à organiser l&apos;action de formation intitulée <b>« {e.course.title} »</b>, relevant de l&apos;article L.6313-1
          du Code du travail (action de formation){e.course.rncpCode ? `, préparant à la certification ${e.course.rncpCode}` : ""}.
        </p>
      </A>
      <A n={++n} title="Nature, durée et organisation">
        <p>Objectifs : {e.course.objectives ? e.course.objectives.replace(/^- /gm, "• ") : "voir programme en annexe"}</p>
        <p>
          Durée : <b>{hours ?? "…"} heures</b>, du <b>{formatDate(e.startDate)}</b> au <b>{formatDate(e.endDate)}</b>. Modalité : {MODALITY_LABELS[e.course.modality]}
          {e.session?.location ? ` – ${e.session.location}` : ""}.
        </p>
        {e.course.modality !== "PRESENTIEL" && (
          <p>
            La formation se déroule à distance sur la plateforme {appUrl()}. Conformément à l&apos;article D.6313-3-1, le stagiaire bénéficie d&apos;une assistance technique et
            pédagogique (messagerie de la formation, réponse sous 48 h ouvrées) ; les activités et le temps de connexion sont enregistrés pour justifier la réalisation de la formation.
          </p>
        )}
        <p>Le programme détaillé figure en annexe et sur la plateforme.</p>
      </A>
      <A n={++n} title="Prérequis et public">
        <p>{e.course.prerequisites ?? "Aucun prérequis."} {e.course.audience ? `Public : ${e.course.audience}` : ""}</p>
      </A>
      <A n={++n} title="Suivi, évaluation et sanction">
        <p>
          Positionnement à l&apos;entrée, évaluations en cours de formation (quiz, mises en situation évaluées par grille), auto-évaluation de fin de formation et questionnaires de
          satisfaction. {e.course.evaluationMethods ?? ""} À l&apos;issue de la formation, un certificat de réalisation et, en cas de réussite, une attestation de fin de formation
          sont délivrés.
        </p>
      </A>
      <A n={++n} title="Dispositions financières">
        <p>
          Prix de la formation : <b>{e.course.price != null ? `${e.course.price.toLocaleString("fr-FR")} € HT` : "selon devis"}</b>. Financement :{" "}
          {e.fundingType ? FUNDING_TYPES[e.fundingType] : "—"}{e.fundingReference ? ` (réf. ${e.fundingReference})` : ""}.
        </p>
        {isContract && (
          <p>
            Aucune somme ne peut être exigée avant l&apos;expiration du délai de rétractation. Un acompte de 30 % maximum du prix peut être demandé à l&apos;issue de ce délai ;
            le solde est échelonné au fur et à mesure du déroulement de l&apos;action (art. L.6353-6).
          </p>
        )}
      </A>
      {isContract && (
        <A n={++n} title="Délai de rétractation">
          <p>
            À compter de la date de signature du présent contrat, le stagiaire dispose d&apos;un délai de <b>10 jours</b> pour se rétracter, par lettre recommandée avec avis de
            réception (art. L.6353-5). {e.fundingType === "CPF" ? "Pour un achat via Mon Compte Formation, les conditions générales de la plateforme s'appliquent également." : ""}
          </p>
        </A>
      )}
      <A n={++n} title="Interruption et abandon">
        <p>
          En cas de cessation anticipée de la formation du fait de l&apos;organisme ou d&apos;abandon du stagiaire pour un motif de force majeure dûment reconnu, seules les prestations
          effectivement dispensées sont dues au prorata temporis de leur valeur prévue (art. L.6354-1). La date et le motif de l&apos;interruption sont enregistrés.
        </p>
      </A>
      <A n={++n} title="Règlement intérieur, données personnelles, accessibilité">
        <p>
          Le stagiaire s&apos;engage à respecter le règlement intérieur de l&apos;organisme{org.internalRulesUrl ? ` (${org.internalRulesUrl})` : ""}. Ses données sont traitées pour la
          gestion de la formation et les obligations déclaratives, conformément à la politique de confidentialité. {org.referentHandicap ? `Référent handicap : ${org.referentHandicap}.` : ""}
        </p>
      </A>
      <A n={++n} title="Litiges">
        <p>
          En cas de différend, les parties recherchent une solution amiable. {isContract && org.mediatorInfo ? `Médiateur de la consommation : ${org.mediatorInfo}. ` : ""}À défaut, le tribunal
          compétent est celui du siège de l&apos;organisme.
        </p>
      </A>

      <div className="mt-8 grid grid-cols-2 gap-8 text-[13px]">
        <div>
          <div className="font-semibold">Le stagiaire</div>
          {e.conventionSignedAt ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.conventionSignature!} alt="Signature du stagiaire" className="mt-1 h-16" />
              <div className="text-xs text-slate-500">
                Signé électroniquement le {formatDate(e.conventionSignedAt, true)} (IP {e.conventionSignedIp ?? "—"})
              </div>
            </>
          ) : isLearner ? (
            <div className="no-print mt-2">
              <p className="mb-2 text-xs text-slate-500">Lu et approuvé — tracez votre signature :</p>
              <SignaturePad onSign={signConventionAction.bind(null, e.id)} label="Signer la convention" />
            </div>
          ) : (
            <div className="mt-2 text-xs text-amber-700">En attente de signature du stagiaire</div>
          )}
        </div>
        <div className="text-right">
          <div className="font-semibold">Pour l&apos;organisme de formation</div>
          <div>{org.managerName ?? ""}{org.managerTitle ? `, ${org.managerTitle}` : ""}</div>
          {org.signatureImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.signatureImage} alt="Signature de l'organisme" className="ml-auto mt-1 h-16" />
          )}
        </div>
      </div>
      {hasEmployer && <div className="mt-6 text-[13px]"><div className="font-semibold">Pour l&apos;entreprise</div><div className="mt-10 text-xs text-slate-500">Signature et cachet</div></div>}

      <section className="mt-10 border-t border-slate-200 pt-4">
        <h2 className="text-sm font-bold">Annexe – Programme</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px]">
          {e.course.modules.map((m) => (
            <li key={m.id}>
              <b>{m.title}</b> — {m.lessons.map((l) => l.title).join(" · ")}
            </li>
          ))}
        </ol>
      </section>
    </DocShell>
  );
}
