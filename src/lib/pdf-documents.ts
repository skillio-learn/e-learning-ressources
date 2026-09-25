import "server-only";
import type { enrollmentTrace } from "./reports";
import { PdfBuilder } from "./pdf";
import { EXIT_REASONS, MODALITY_LABELS, formatDuration, formatHours } from "./labels";

type Trace = NonNullable<Awaited<ReturnType<typeof enrollmentTrace>>>;

const d = (x: Date | null | undefined) => (x ? x.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "-");
const dt = (x: Date | null | undefined) => (x ? x.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }) : "-");

function orgLines(org: Trace["enrollment"]["course"]["organization"]) {
  return [
    org.legalName || org.name,
    [org.address, [org.postalCode, org.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    [org.siret && `SIRET ${org.siret}`, org.nda && `NDA ${org.nda}${org.ndaRegion ? ` (${org.ndaRegion})` : ""}`, org.qualiopiNumber && `Qualiopi ${org.qualiopiNumber}`]
      .filter(Boolean)
      .join(" · "),
  ];
}

function learnerName(t: Trace) {
  const p = t.enrollment.user.profile;
  return [p?.civility, p?.firstName, p?.lastName].filter(Boolean).join(" ") || t.enrollment.user.name;
}

/** Certificat de réalisation (modèle du ministère du Travail) : justificatif pour OPCO, France Travail, CPF. */
export async function realisationPdf(t: Trace) {
  const e = t.enrollment;
  const org = e.course.organization;
  const pdf = await PdfBuilder.create({ title: `Certificat de réalisation – ${learnerName(t)}`, subject: e.course.title, author: org.name });
  pdf.setFooter(`Réf. inscription ${e.id}`);
  pdf.header(orgLines(org), "Certificat de réalisation", e.course.title);
  pdf.text(
    `Je soussigné(e) ${org.managerName || "…"}, représentant légal du dispensateur de l'action concourant au développement des compétences ${org.legalName || org.name}${org.nda ? ` (déclaration d'activité n° ${org.nda})` : ""}, atteste que :`,
  );
  pdf.space(8);
  pdf.text(learnerName(t), { size: 14, bold: true });
  pdf.space(6);
  const hours = Math.round((t.totalSeconds / 3600) * 100) / 100;
  pdf.keyValues([
    ["Entreprise / dispositif", e.user.profile?.employerName || "-"],
    ["Action suivie", `${e.course.title}${e.course.rncpCode ? ` (${e.course.rncpCode})` : ""}`],
    ["Nature de l'action", "Action de formation"],
    ["Modalité", MODALITY_LABELS[e.course.modality] ?? e.course.modality],
    ["Période", `du ${d(e.startDate ?? t.firstActivity ?? e.enrolledAt)} au ${d(e.exitDate ?? e.completedAt ?? e.endDate ?? t.lastActivity)}`],
    ["Durée prévue", e.plannedHours ? `${e.plannedHours} heures` : e.course.durationHours ? `${e.course.durationHours} heures` : "-"],
    ["Durée réalisée", `${hours.toLocaleString("fr-FR")} heures (${formatHours(t.totalSeconds)})`],
    ["Progression", `${t.completedSteps} / ${t.totalSteps} étapes (${t.percent} %)`],
    ["Référence du financement", e.fundingReference || "-"],
  ]);
  if (e.exitDate) {
    pdf.space(6);
    pdf.text(
      `Le stagiaire a interrompu la formation le ${d(e.exitDate)} (motif : ${EXIT_REASONS[e.exitCategory ?? ""] ?? e.exitCategory ?? "-"}). La durée réalisée correspond aux heures effectivement suivies avant cette date.`,
      { size: 9.5 },
    );
  }
  pdf.space(10);
  pdf.text(
    "Temps mesuré par la plateforme : temps actif (onglet visible et activité récente de l'apprenant), horodaté et conservé avec les adresses IP de connexion. Le relevé détaillé des connexions est disponible sur demande.",
    { size: 8.5, color: undefined },
  );
  pdf.space(6);
  pdf.text(
    "Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m'engage à conserver l'ensemble des pièces justificatives qui ont permis d'établir le présent certificat pendant une durée de 3 ans à compter de la fin de l'année du dernier paiement.",
    { size: 8 },
  );
  await pdf.signature(`Fait à ${org.city || "…"}, le ${d(new Date())}`, org.managerName || "Le responsable de l'organisme", org.managerTitle || "Représentant légal", org.signatureImage);
  return pdf.save();
}

/** Relevé des connexions et du temps de formation : preuve d'assiduité à distance (FOAD). */
export async function relevePdf(t: Trace) {
  const e = t.enrollment;
  const org = e.course.organization;
  const pdf = await PdfBuilder.create({ title: `Relevé de connexions – ${learnerName(t)}`, subject: e.course.title, author: org.name });
  pdf.setFooter(`Réf. inscription ${e.id}`);
  pdf.header(orgLines(org), "Relevé de connexions et de temps de formation", e.course.title);
  pdf.keyValues([
    ["Apprenant", `${learnerName(t)} (${e.user.email})`],
    ["Formation", e.course.title],
    ["Période d'inscription", `du ${d(t.periodStart)} au ${d(e.exitDate ?? e.completedAt ?? e.endDate)}`],
    ["Première / dernière activité", `${dt(t.firstActivity)} / ${dt(t.lastActivity)}`],
    ["Temps de formation total", `${formatHours(t.totalSeconds)} (${formatDuration(t.totalSeconds)})`],
    ["Progression", `${t.completedSteps} / ${t.totalSteps} étapes (${t.percent} %)`],
    ["Connexions", String(t.logins.filter((l) => l.type === "LOGIN").length)],
  ]);

  pdf.heading("Temps de formation par jour");
  pdf.table(
    [
      { label: "Date", width: 70 },
      { label: "Début", width: 55 },
      { label: "Fin", width: 55 },
      { label: "Temps actif", width: 70, align: "right" },
      { label: "Étapes travaillées", width: 250 },
    ],
    t.days.map((x) => [
      new Date(x.day).toLocaleDateString("fr-FR", { timeZone: "UTC" }),
      x.firstAt.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }),
      x.lastAt.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }),
      formatDuration(x.seconds),
      x.lessons.join(" · "),
    ]),
  );

  pdf.heading("Temps et statut par étape du parcours");
  pdf.table(
    [
      { label: "Étape", width: 250 },
      { label: "Temps", width: 70, align: "right" },
      { label: "Statut", width: 70 },
      { label: "Terminée le", width: 80 },
      { label: "Score", width: 45, align: "right" },
    ],
    t.lessons.map((l) => [l.title, formatDuration(l.seconds), l.completed ? "Terminée" : l.seconds > 0 ? "Commencée" : "-", l.completedAt ? d(l.completedAt) : "-", l.score !== null ? `${Math.round(l.score)} %` : "-"]),
  );

  pdf.heading("Journal des connexions");
  const EVT: Record<string, string> = { LOGIN: "Connexion", LOGOUT: "Déconnexion", FAILED: "Échec", LOCKED: "Verrouillé" };
  pdf.table(
    [
      { label: "Date et heure", width: 110 },
      { label: "Évènement", width: 80 },
      { label: "Adresse IP", width: 100 },
      { label: "Navigateur", width: 210 },
    ],
    t.logins.map((l) => [dt(l.createdAt), EVT[l.type] ?? l.type, l.ip ?? "-", (l.userAgent ?? "-").slice(0, 90)]),
    7.5,
  );

  pdf.heading("Sessions de travail (temps actif mesuré)");
  pdf.table(
    [
      { label: "Début", width: 110 },
      { label: "Fin / dernier signal", width: 110 },
      { label: "Temps actif", width: 80, align: "right" },
      { label: "Adresse IP", width: 100 },
    ],
    t.sessions.map((s) => [dt(s.startedAt), dt(s.endedAt ?? s.lastSeenAt), formatDuration(s.activeSeconds), s.ip ?? "-"]),
    7.5,
  );
  if (t.signatures.length) {
    pdf.heading("Émargements en session");
    pdf.table(
      [
        { label: "Date", width: 100 },
        { label: "Créneau", width: 150 },
        { label: "Signé le", width: 130 },
      ],
      t.signatures.map((s) => [d(s.slot.date), `${s.slot.label} ${s.slot.startTime}-${s.slot.endTime}`, dt(s.signedAt)]),
    );
  }
  await pdf.signature(`Fait à ${org.city || "…"}, le ${d(new Date())}`, org.managerName || "Le responsable de l'organisme", org.managerTitle || "Représentant légal", org.signatureImage);
  return pdf.save();
}

/** Résultats d'une tentative de quiz, avec les réponses de l'apprenant (apprenant, formateur, OF). */
export async function quizAttemptPdf(attemptId: string, opts: { showCorrection: boolean }) {
  const { db } = await import("./db");
  const a = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: { select: { name: true, email: true, profile: { select: { firstName: true, lastName: true, civility: true } } } },
      answers: true,
      quiz: {
        include: {
          questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } },
          lesson: { select: { title: true, module: { select: { title: true, position: true, course: { select: { title: true, organization: true } } } } } },
        },
      },
    },
  });
  if (!a) return null;
  const course = a.quiz.lesson.module.course;
  const org = course.organization;
  const learner = [a.user.profile?.civility, a.user.profile?.firstName, a.user.profile?.lastName].filter(Boolean).join(" ") || a.user.name;
  const pdf = await PdfBuilder.create({ title: `Résultats – ${a.quiz.lesson.title} – ${learner}`, subject: course.title, author: org.name });
  pdf.setFooter(`Réf. tentative ${a.id}`);
  pdf.header(orgLines(org), `Résultats du quiz : ${a.quiz.lesson.title}`, `${course.title} · Module ${a.quiz.lesson.module.position + 1} – ${a.quiz.lesson.module.title}`);
  const status = a.status === "PENDING_REVIEW" ? "En attente de correction (questions ouvertes)" : a.passed ? "Réussi" : "Non validé";
  const duration = a.submittedAt ? Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 1000) : null;
  pdf.keyValues([
    ["Apprenant", `${learner} (${a.user.email})`],
    ["Commencé le", dt(a.startedAt)],
    ["Remis le", dt(a.submittedAt)],
    ["Durée", duration !== null ? formatDuration(duration) : "-"],
    ["Note", `${a.score.toLocaleString("fr-FR")} / ${a.maxScore.toLocaleString("fr-FR")} points (${Math.round(a.percent)} %)`],
    ["Seuil de réussite", `${a.quiz.passingScore} %`],
    ["Résultat", status],
  ]);
  if (a.feedback) {
    pdf.space(4);
    pdf.text(`Commentaire : ${a.feedback}`, { size: 9.5 });
  }
  const byQ = new Map(a.answers.map((x) => [x.questionId, x]));
  a.quiz.questions.forEach((q, i) => {
    const ans = byQ.get(q.id);
    pdf.heading(`Question ${i + 1} · ${ans ? `${ans.pointsAwarded.toLocaleString("fr-FR")} / ${q.points.toLocaleString("fr-FR")} pt` : `0 / ${q.points} pt`}`);
    pdf.text(q.text, { size: 10 });
    pdf.space(4);
    if (q.options.length) {
      const selected = new Set(ans?.selectedOptionIds ?? []);
      q.options.forEach((o) => {
        const mark = selected.has(o.id) ? "[x]" : "[ ]";
        const corr = opts.showCorrection && o.isCorrect ? "  (bonne réponse)" : "";
        pdf.text(`${mark} ${o.text}${corr}`, { size: 9.5, indent: 10, bold: selected.has(o.id) });
      });
    } else {
      pdf.text(`Réponse : ${ans?.text?.trim() || "(pas de réponse)"}`, { size: 9.5, indent: 10 });
      if (opts.showCorrection && q.type === "SHORT" && q.acceptedAnswers.length) {
        pdf.text(`Réponses acceptées : ${q.acceptedAnswers.join(" · ")}`, { size: 9, indent: 10 });
      }
    }
    if (ans?.needsReview) pdf.text("À corriger par le formateur", { size: 9, indent: 10 });
    if (ans?.feedback) pdf.text(`Correction du formateur : ${ans.feedback}`, { size: 9, indent: 10 });
    if (opts.showCorrection && q.explanation) pdf.text(`Explication : ${q.explanation}`, { size: 9, indent: 10 });
  });
  return { bytes: await pdf.save(), learner, title: a.quiz.lesson.title };
}
