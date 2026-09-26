import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Circle, CircleDot, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { indicatorBoard } from "@/lib/qualiopi-evidence";
import { AUDIT_TYPES, CRITERIA } from "@/lib/qualiopi";
import { Badge, PageHeader, ProgressBar } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Qualiopi" };
export const dynamic = "force-dynamic";

const DAY = 86400_000;

type Step = { title: string; detail: string; state: "done" | "partial" | "todo"; href: string; codes: string };

/** Tableau de bord Qualiopi : état de conformité, parcours guidé en 11 étapes, alertes et échéances d'audit. */
export default async function QualiopiHome() {
  const user = await requireStaff();
  const orgId = user.organizationId!;
  const [org, { rows, version }, nextAudit, openNc, openActions, pendingQuals, pendingAcc, openComplaints, risks, expiringQuals, subsExpiring, auditorLinks] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId } }),
    indicatorBoard(orgId),
    db.qualityAudit.findFirst({ where: { organizationId: orgId, status: "PLANNED", scheduledAt: { gte: new Date(Date.now() - DAY) } }, orderBy: { scheduledAt: "asc" } }),
    db.nonConformity.findMany({ where: { organizationId: orgId, status: { not: "CLOSED" } }, orderBy: { dueAt: "asc" } }),
    db.improvementAction.count({ where: { organizationId: orgId, status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { lt: new Date() } } }),
    db.trainerQualification.count({ where: { organizationId: orgId, status: "PENDING" } }),
    db.accommodation.count({ where: { organizationId: orgId, status: { in: ["REQUESTED", "ANALYSING"] } } }),
    db.complaint.count({ where: { organizationId: orgId, status: { not: "RESOLVED" } } }),
    db.qualityRisk.findMany({ where: { organizationId: orgId }, select: { reviewedAt: true } }),
    db.trainerQualification.count({ where: { organizationId: orgId, status: "VALIDATED", expiresAt: { gte: new Date(), lte: new Date(Date.now() + 60 * DAY) } } }),
    db.subcontractor.count({ where: { organizationId: orgId, qualiopiExpiresAt: { gte: new Date(), lte: new Date(Date.now() + 60 * DAY) } } }),
    db.auditorAccess.count({ where: { organizationId: orgId } }),
  ]);
  const applicable = rows.filter((r) => r.applicable);
  const validated = applicable.filter((r) => r.status === "VALIDATED" && !r.stale).length;
  const stale = applicable.filter((r) => r.stale).length;
  const progress = applicable.length ? Math.round((validated / applicable.length) * 100) : 0;
  const lvl = (codes: string[]) => {
    const rs = rows.filter((r) => codes.includes(r.ind.code) && r.applicable);
    if (!rs.length) return "done" as const;
    if (rs.every((r) => r.status === "VALIDATED" && !r.stale)) return "done" as const;
    if (rs.some((r) => r.auto?.level === "ok" || r.auto?.level === "partial" || r.status !== "TODO")) return "partial" as const;
    return "todo" as const;
  };

  const steps: Step[] = [
    {
      title: "Paramétrer la certification et les référents",
      detail: "Numéro, certificateur, catégories d'actions, version du référentiel, référent qualité et référent handicap.",
      state: org.qualityReferentId && (org.handicapReferentId || org.referentHandicap) && (org.qualiopiNumber || !org.qualiopiCertified) ? "done" : "todo",
      href: "/of/qualiopi/parametres", codes: "Paramètres",
    },
    { title: "Compléter les programmes de formation", detail: "Objectifs, prérequis, public, durée, tarif, délai d'accès, méthodes, évaluation, accessibilité.", state: lvl(["1", "5", "6", "7"]), href: "/of/qualiopi/indicateurs", codes: "Ind. 1, 5, 6, 7" },
    { title: "Publier les indicateurs de résultats", detail: "Satisfaction, réussite, abandon, insertion : datés, avec effectif, période et méthode de calcul.", state: lvl(["2", "3"]), href: "/of/qualiopi/resultats", codes: "Ind. 2, 3" },
    { title: "Analyser le besoin et positionner à l'entrée", detail: "Questionnaire préalable, cahier des charges de l'entreprise, positionnement exploité.", state: lvl(["4", "8"]), href: "/of/qualiopi/indicateurs/4", codes: "Ind. 4, 8" },
    { title: "Accueil, suivi et prévention des ruptures", detail: "Convocations, règlement intérieur avec procédure contre les violences, absences, relances.", state: lvl(["9", "10", "11", "12"]), href: "/of/qualiopi/indicateurs/12", codes: "Ind. 9 à 12" },
    { title: "Moyens et coordination pédagogique", detail: "Ressources par module, référent pédagogique par formation, coordination des intervenants.", state: lvl(["17", "18", "19"]), href: "/of/qualiopi/indicateurs/19", codes: "Ind. 17 à 19" },
    { title: "Compétences des intervenants", detail: "CV et diplômes vérifiés, formations suivies par chaque formateur.", state: lvl(["21", "22"]), href: "/of/qualiopi/formateurs", codes: "Ind. 21, 22" },
    { title: "Veille, handicap et sous-traitance", detail: "Fiches de veille exploitées, registre handicap, contrats des sous-traitants.", state: lvl(["23", "24", "25", "26", "27"]), href: "/of/qualiopi/veille", codes: "Ind. 23 à 27" },
    { title: "Recueillir les avis et traiter les réclamations", detail: "Satisfaction à chaud et à froid, avis des entreprises, réclamations avec réponse.", state: lvl(["30", "31"]), href: "/of/quality", codes: "Ind. 30, 31" },
    { title: "Améliorer en continu et maîtriser les risques", detail: "Plan d'actions suivi jusqu'à son efficacité et cartographie des risques.", state: lvl(["32"]), href: "/of/qualiopi/amelioration", codes: "Ind. 32" },
    {
      title: "Préparer l'audit",
      detail: "Tous les indicateurs applicables validés depuis moins d'un an, dossier de preuves prêt, lien d'accès pour l'auditeur.",
      state: progress === 100 && auditorLinks > 0 ? "done" : progress >= 60 ? "partial" : "todo",
      href: "/of/qualiopi/dossier", codes: "Tous",
    },
  ];

  const alerts: { text: string; href: string }[] = [];
  if (org.qualiopiExpiresAt && org.qualiopiExpiresAt.getTime() - Date.now() < 120 * DAY) alerts.push({ text: `Le certificat expire le ${formatDate(org.qualiopiExpiresAt)} : planifiez l'audit de renouvellement.`, href: "/of/qualiopi/audits" });
  for (const nc of openNc) alerts.push({ text: `Non-conformité ${nc.level === "MAJOR" ? "majeure" : "mineure"} (indicateur ${nc.indicatorCode}) à lever${nc.dueAt ? ` avant le ${formatDate(nc.dueAt)}` : ""}.`, href: "/of/qualiopi/audits" });
  if (openNc.filter((n) => n.level === "MINOR").length >= 5) alerts.push({ text: "5 non-conformités mineures non levées valent une non-conformité majeure.", href: "/of/qualiopi/audits" });
  if (stale) alerts.push({ text: `${stale} indicateur(s) validé(s) il y a plus d'un an : à revoir.`, href: "/of/qualiopi/indicateurs" });
  if (openActions) alerts.push({ text: `${openActions} action(s) d'amélioration en retard.`, href: "/of/qualiopi/amelioration" });
  if (pendingQuals) alerts.push({ text: `${pendingQuals} justificatif(s) de formateur à vérifier.`, href: "/of/qualiopi/formateurs" });
  if (expiringQuals) alerts.push({ text: `${expiringQuals} certification(s) de formateur expirent dans les 60 jours.`, href: "/of/qualiopi/formateurs" });
  if (subsExpiring) alerts.push({ text: `${subsExpiring} sous-traitant(s) dont la certification Qualiopi expire bientôt.`, href: "/of/qualiopi/sous-traitants" });
  if (pendingAcc) alerts.push({ text: `${pendingAcc} demande(s) d'aménagement handicap à traiter.`, href: "/of/qualiopi/handicap" });
  if (openComplaints) alerts.push({ text: `${openComplaints} réclamation(s) ou signalement(s) en cours.`, href: "/of/quality" });
  if (version === "2026" && risks.some((r) => !r.reviewedAt || Date.now() - r.reviewedAt.getTime() > 365 * DAY)) alerts.push({ text: "Des risques n'ont pas été revus depuis plus d'un an.", href: "/of/qualiopi/amelioration" });

  const days = nextAudit ? Math.ceil((nextAudit.scheduledAt.getTime() - Date.now()) / DAY) : null;
  const icon = { done: <CheckCircle2 className="h-5 w-5 text-emerald-600" strokeWidth={1.75} aria-label="Fait" />, partial: <CircleDot className="h-5 w-5 text-brand-600" strokeWidth={1.75} aria-label="En cours" />, todo: <Circle className="h-5 w-5 text-slate-400" strokeWidth={1.75} aria-label="À faire" /> };

  return (
    <>
      <PageHeader
        title="Qualiopi"
        subtitle={version === "2026" ? "Référentiel national qualité 2026 (33 indicateurs, décret n° 2026-728) : applicable à tout audit réalisé à partir du 1er novembre 2026." : "Référentiel national qualité 2019 (32 indicateurs, guide de lecture V9)."}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500"><ShieldCheck className="h-4 w-4 text-brand-600" strokeWidth={1.75} /> Certification</div>
          {org.qualiopiCertified ? (
            <>
              <div className="mt-2 font-title text-2xl text-brand-600">Certifié</div>
              <div className="mt-1 text-sm text-slate-500">{org.qualiopiNumber ? `N° ${org.qualiopiNumber}` : "Numéro à renseigner"}{org.qualiopiCertifier ? ` · ${org.qualiopiCertifier}` : ""}</div>
              {org.qualiopiExpiresAt && <div className="mt-1 text-sm text-slate-500">Valable jusqu&apos;au {formatDate(org.qualiopiExpiresAt)}</div>}
            </>
          ) : (
            <>
              <div className="mt-2 font-title text-2xl text-brand-600">En préparation</div>
              <div className="mt-1 text-sm text-slate-500">Suivez le parcours ci-dessous pour préparer l&apos;audit initial.</div>
            </>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500"><CalendarClock className="h-4 w-4 text-brand-600" strokeWidth={1.75} /> Prochain audit</div>
          {nextAudit ? (
            <>
              <div className="mt-2 font-title text-2xl text-brand-600">{days! <= 0 ? "Aujourd'hui" : `Dans ${days} jour(s)`}</div>
              <div className="mt-1 text-sm text-slate-500">{AUDIT_TYPES[nextAudit.type]} · {formatDate(nextAudit.scheduledAt)}{nextAudit.remote ? " · à distance" : " · sur site"}</div>
            </>
          ) : (
            <>
              <div className="mt-2 font-title text-2xl text-brand-600">Non planifié</div>
              <Link href="/of/qualiopi/audits" className="link mt-1 inline-block text-sm">Planifier un audit</Link>
            </>
          )}
        </div>
        <div className="card p-5">
          <div className="text-sm text-slate-500">Indicateurs validés</div>
          <div className="mt-2 font-title text-2xl text-brand-600">{validated} / {applicable.length}</div>
          <ProgressBar value={progress} className="mt-3" />
          <div className="mt-2 text-sm text-slate-500">{rows.length - applicable.length} indicateur(s) non applicable(s) justifié(s)</div>
        </div>
      </div>

      {alerts.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-xl"><AlertTriangle className="h-5 w-5 text-red-600" strokeWidth={1.75} /> Points d&apos;attention</h2>
          <ul className="divide-y divide-slate-100">
            {alerts.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span>{a.text}</span>
                <Link href={a.href} className="link shrink-0">Traiter</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-6">
          <h2 className="text-xl">Votre parcours de conformité</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">Onze étapes, dans l&apos;ordre. Chaque étape s&apos;appuie sur les preuves déjà produites par la plateforme.</p>
          <ol className="space-y-1">
            {steps.map((s, i) => (
              <li key={s.title}>
                <Link href={s.href} className="flex items-start gap-3 rounded-[10px] p-3 transition-colors hover:bg-slate-50">
                  <span className="mt-0.5">{icon[s.state]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-900">{i + 1}. {s.title}</span>
                    <span className="block text-sm text-slate-500">{s.detail}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{s.codes}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className="card p-6">
          <h2 className="text-xl">Par critère</h2>
          <div className="mt-4 space-y-4">
            {CRITERIA.map((c) => {
              const rs = applicable.filter((r) => r.ind.criterion === c.n);
              const v = rs.filter((r) => r.status === "VALIDATED" && !r.stale).length;
              return (
                <Link key={c.n} href={`/of/qualiopi/indicateurs#critere-${c.n}`} className="block">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-900">{c.n}. {c.title}</span>
                    <span className="shrink-0 text-slate-500">{v}/{rs.length}</span>
                  </div>
                  <ProgressBar value={rs.length ? (v / rs.length) * 100 : 100} className="mt-2" />
                </Link>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-4 text-sm">
            <Badge tone="green">Validé</Badge><Badge tone="blue">Prêt à valider</Badge><Badge>En cours</Badge><Badge tone="red">À faire</Badge>
          </div>
        </section>
      </div>
    </>
  );
}
