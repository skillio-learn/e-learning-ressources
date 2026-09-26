import "server-only";
import { createHash } from "crypto";

type ConvOrg = { name: string; legalName: string | null; address: string | null; postalCode: string | null; city: string | null; siret: string | null; nda: string | null; managerName: string | null; managerTitle: string | null; qualiopiNumber: string | null };
type ConvCompany = { name: string; legalName: string | null; siret: string | null; address: string | null; postalCode: string | null; city: string | null };
type ConvCourse = { title: string; objectives: string | null; durationHours: number | null; pedagogicalMethods: string | null; evaluationMethods: string | null; modality: string; rncpCode: string | null };
type ConvSession = { name: string; startDate: Date; endDate: Date; format: string; location: string | null; address: string | null; city: string | null } | null;
type Conv = { reference: string; trainees: string[]; hours: number | null; price: number | null; vatRate: number | null; paymentTerms: string | null };

const d = (x: Date) => x.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const MOD: Record<string, string> = { FOAD: "à distance (FOAD)", PRESENTIEL: "en présentiel", MIXTE: "mixte (présentiel et distance)" };

/**
 * Convention de formation professionnelle entre l'OF et l'entreprise (art. L.6353-1 et D.6353-1 du Code du travail) :
 * intitulé, objectifs, contenu, moyens, durée, période, déroulement, suivi et sanction, prix et règlement, stagiaires.
 */
export function companyConventionText(conv: Conv, org: ConvOrg, company: ConvCompany, course: ConvCourse, session: ConvSession) {
  const orgAddr = [org.address, [org.postalCode, org.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const coAddr = [company.address, [company.postalCode, company.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const vat = conv.vatRate ?? 0;
  const ht = conv.price ?? 0;
  const lines = [
    `CONVENTION DE FORMATION PROFESSIONNELLE N° ${conv.reference}`,
    "Articles L.6353-1 et D.6353-1 du Code du travail",
    "",
    "ENTRE",
    `${org.legalName ?? org.name}, ${orgAddr}${org.siret ? `, SIRET ${org.siret}` : ""}${org.nda ? `, déclaration d'activité n° ${org.nda} (cet enregistrement ne vaut pas agrément de l'État)` : ""}${org.qualiopiNumber ? `, certifié Qualiopi n° ${org.qualiopiNumber}` : ""}, représenté par ${[org.managerName, org.managerTitle].filter(Boolean).join(", ") || "son représentant légal"}, ci-après « l'organisme de formation » ;`,
    "ET",
    `${company.legalName ?? company.name}${coAddr ? `, ${coAddr}` : ""}${company.siret ? `, SIRET ${company.siret}` : ""}, ci-après « l'entreprise ».`,
    "",
    "Article 1 · Objet",
    `L'organisme de formation s'engage à organiser l'action de formation « ${course.title} »${course.rncpCode ? ` (certification ${course.rncpCode})` : ""}, action concourant au développement des compétences au sens de l'article L.6313-1 du Code du travail.`,
    "",
    "Article 2 · Objectifs et contenu",
    course.objectives ? `Objectifs : ${course.objectives}` : "Objectifs et contenu : conformes au programme remis à l'entreprise.",
    "Le programme détaillé est annexé à la présente convention.",
    "",
    "Article 3 · Durée, période et lieu",
    `Durée : ${conv.hours ?? course.durationHours ?? "—"} heures par stagiaire.`,
    session ? `Période : du ${d(session.startDate)} au ${d(session.endDate)} (${session.name}, session ${session.format === "INTRA" ? "intra-entreprise" : "inter-entreprises"}).` : "Période : selon le calendrier convenu entre les parties.",
    `Modalité : ${MOD[course.modality] ?? course.modality}${session && (session.address || session.location) ? `, lieu : ${[session.address, session.city].filter(Boolean).join(", ") || session.location}` : ""}.`,
    "",
    "Article 4 · Stagiaires",
    conv.trainees.length ? conv.trainees.map((t) => `- ${t}`).join("\n") : "Liste des stagiaires communiquée par l'entreprise avant le début de la formation.",
    "",
    "Article 5 · Moyens pédagogiques, techniques et d'encadrement",
    course.pedagogicalMethods ?? "Formation animée par un formateur qualifié ; supports et ressources accessibles sur la plateforme Vylia ; assistance pédagogique et technique.",
    "",
    "Article 6 · Suivi et sanction de la formation",
    "L'assiduité est justifiée par les feuilles d'émargement et, pour les séquences à distance, par les relevés de connexion et d'activité de la plateforme.",
    course.evaluationMethods ? `Évaluation : ${course.evaluationMethods}` : "Les acquis sont évalués en cours et en fin de formation.",
    "Un certificat de réalisation est délivré à l'issue de la formation ; l'entreprise peut consulter le suivi de ses salariés dans son espace Vylia.",
    "",
    "Article 7 · Dispositions financières",
    conv.price !== null ? `Prix de la formation : ${eur(ht)} HT${vat ? `, TVA ${vat} % : ${eur((ht * vat) / 100)}, soit ${eur(ht * (1 + vat / 100))} TTC` : " (TVA non applicable, article 261-4-4° a du CGI)"}.` : "Prix : selon devis accepté.",
    conv.paymentTerms ?? "Règlement à réception de facture, à l'issue de la formation. En cas de prise en charge par un OPCO, l'entreprise effectue la demande avant le début de la formation et reste redevable des sommes non prises en charge.",
    "",
    "Article 8 · Dédit, abandon et absences",
    "En cas de dédit de l'entreprise moins de 10 jours avant le début de la formation, 30 % du prix restent dus à titre de dédommagement. Les heures non réalisées du fait de l'absence du stagiaire sont facturées à l'entreprise, sans pouvoir être imputées sur sa contribution à la formation professionnelle. En cas d'abandon, seules les prestations effectivement réalisées sont dues, au prorata temporis.",
    "",
    "Article 9 · Litiges",
    "À défaut de règlement amiable, tout litige relève des tribunaux compétents du siège de l'organisme de formation.",
  ];
  const text = lines.join("\n");
  return { text, hash: createHash("sha256").update(text).digest("hex") };
}
