import Link from "next/link";
import { db } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { getCourseOutline, getLearnerResults } from "@/lib/progress";
import { saveNeedsAnalysisAction } from "@/app/actions/companies";
import { StateForm } from "@/components/StateForm";
import { Badge, Container, Empty, Field, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { ENROLLMENT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Espace entreprise" };

const hours = (s: number) => `${(s / 3600).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;

export default async function CompanyHome() {
  const user = await requireCompany();
  const company = user.companyId
    ? await db.company.findUnique({ where: { id: user.companyId }, include: { organization: { select: { name: true, email: true, phone: true } } } })
    : null;
  if (!company || !company.active) {
    return (
      <Container>
        <Empty title="Espace indisponible">Votre accès entreprise n&apos;est pas actif. Contactez l&apos;organisme de formation.</Empty>
      </Container>
    );
  }
  const now = new Date();
  const [enrollments, conventions, feedbacks, analyses] = await Promise.all([
    db.enrollment.findMany({
      where: { companyId: company.id },
      orderBy: [{ status: "asc" }, { enrolledAt: "desc" }],
      include: {
        user: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
        session: { select: { id: true, name: true, slots: { where: { date: { lte: now } }, select: { id: true } } } },
      },
    }),
    db.companyConvention.findMany({ where: { companyId: company.id, status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" }, include: { session: { select: { name: true } } } }),
    db.funderFeedback.findMany({ where: { enrollment: { companyId: company.id }, respondentType: "EMPLOYER", answeredAt: null }, include: { enrollment: { select: { user: { select: { name: true } }, course: { select: { title: true } } } } } }),
    db.needsAnalysis.findMany({ where: { companyId: company.id } }),
  ]);
  const sessionIds = [...new Set(enrollments.map((e) => e.sessionId).filter(Boolean) as string[])];
  const sessions = await db.trainingSession.findMany({
    where: { OR: [{ companyId: company.id }, { id: { in: sessionIds } }] },
    orderBy: { startDate: "desc" },
    include: { course: { select: { title: true, durationHours: true } }, trainer: { select: { name: true } } },
  });

  const rows = await Promise.all(
    enrollments.map(async (e) => {
      const [outline, time, results, signed, absences] = await Promise.all([
        company.shareProgress ? getCourseOutline(e.courseId, e.userId, { ignoreLocks: true }) : null,
        company.shareTime ? db.timeLog.aggregate({ where: { userId: e.userId, courseId: e.courseId }, _sum: { seconds: true } }) : null,
        company.shareResults ? getLearnerResults(e.userId, e.courseId) : null,
        company.shareAttendance && e.session ? db.attendanceSignature.count({ where: { userId: e.userId, slot: { sessionId: e.session.id } } }) : 0,
        company.shareAttendance || company.shareAbsenceAlerts ? db.absenceRecord.findMany({ where: { userId: e.userId, slot: { sessionId: e.sessionId ?? "__" } }, select: { status: true, kind: true } }) : [],
      ]);
      const finished = e.status === "COMPLETED" || e.status === "ABANDONED" || !!e.exitDate;
      return { e, percent: outline?.percent ?? null, seconds: time?._sum.seconds ?? null, average: results?.average ?? null, signed, slots: e.session?.slots.length ?? 0, absences, finished };
    }),
  );
  const alerts = rows.filter((r) => company.shareAbsenceAlerts && (r.e.absenceAlertAt || r.absences.some((a) => a.status !== "ACCEPTED" && a.kind === "ABSENCE")));
  const toSign = conventions.filter((c) => c.status === "SENT");
  const upcoming = sessions.filter((s) => s.endDate >= now);
  const needs = upcoming.filter((s) => !analyses.some((a) => a.sessionId === s.id));

  return (
    <Container>
      <PageHeader title={company.name} subtitle={`Suivi de vos salariés en formation avec ${company.organization.name}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Salariés en formation" value={rows.filter((r) => r.e.status === "ACTIVE").length} hint={`${rows.length} au total`} />
        <Stat label="Formations terminées" value={rows.filter((r) => r.e.status === "COMPLETED").length} />
        <Stat label="Conventions à signer" value={toSign.length} />
        <Stat label="Alertes d'absence" value={alerts.length} />
      </div>

      {(toSign.length > 0 || feedbacks.length > 0 || needs.length > 0) && (
        <section className="card mt-6 p-6">
          <h2 className="text-xl">À faire</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {toSign.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>Signer la convention {c.reference} · {c.session?.name}</span>
                <Link href={`/entreprise/conventions/${c.id}`} className="btn-primary btn-sm">Lire et signer</Link>
              </li>
            ))}
            {needs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>Exprimer vos besoins pour la session {s.name}</span>
                <a href={`#besoin-${s.id}`} className="btn-secondary btn-sm">Compléter l&apos;analyse</a>
              </li>
            ))}
            {feedbacks.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>Évaluer la formation de {f.enrollment?.user.name} · {f.enrollment?.course.title}</span>
                <Link href={`/feedback/${f.token}`} className="btn-secondary btn-sm">Donner mon avis</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {alerts.length > 0 && (
        <section className="mt-6 rounded-[10px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <b>Absences à suivre :</b> {alerts.map((r) => r.e.user.name).join(", ")}. L&apos;organisme vous tient informé ; rapprochez-vous de vos salariés si besoin.
        </section>
      )}

      <section className="card mt-6 overflow-x-auto">
        <div className="px-6 pt-5"><h2 className="text-xl">Vos salariés</h2></div>
        {rows.length === 0 ? <p className="px-6 pb-6 pt-2 text-sm text-slate-500">Aucun salarié inscrit pour le moment.</p> : (
          <table className="table mt-3">
            <thead>
              <tr>
                <th>Salarié</th><th>Formation</th><th>Statut</th>
                {company.shareProgress && <th>Progression</th>}
                {company.shareTime && <th>Temps réalisé</th>}
                {company.shareAttendance && <th>Émargement</th>}
                {company.shareResults && <th>Moyenne</th>}
                {company.shareDocuments && <th>Documents</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.e.id}>
                  <td className="font-medium text-slate-900">{r.e.user.name}</td>
                  <td>{r.e.course.title}{r.e.session && <div className="text-xs text-slate-500">{r.e.session.name}</div>}</td>
                  <td><Badge tone={ENROLLMENT_STATUS[r.e.status].tone}>{ENROLLMENT_STATUS[r.e.status].label}</Badge></td>
                  {company.shareProgress && <td className="min-w-32"><ProgressBar value={r.percent ?? 0} /><span className="text-xs text-slate-500">{r.percent ?? 0} %</span></td>}
                  {company.shareTime && <td>{hours(r.seconds ?? 0)}</td>}
                  {company.shareAttendance && (
                    <td>
                      {r.slots ? `${r.signed} / ${r.slots} demi-journées` : "—"}
                      {r.absences.length > 0 && <div className="text-xs text-slate-500">{r.absences.filter((a) => a.status === "ACCEPTED").length} justifiée(s), {r.absences.filter((a) => a.status !== "ACCEPTED").length} non justifiée(s)</div>}
                    </td>
                  )}
                  {company.shareResults && <td>{r.average !== null ? `${r.average} %` : "—"}</td>}
                  {company.shareDocuments && (
                    <td className="space-x-2 whitespace-nowrap text-xs">
                      <Link href={`/documents/convocation/${r.e.id}`} className="link">Convocation</Link>
                      {company.shareAttendance && <Link href={`/documents/assiduite/${r.e.id}`} className="link">Assiduité</Link>}
                      {r.finished && <Link href={`/documents/realisation/${r.e.id}`} className="link">Certificat de réalisation</Link>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="text-xl">Sessions</h2>
        {sessions.length === 0 && <p className="text-sm text-slate-500">Aucune session programmée.</p>}
        {sessions.map((s) => {
          const na = analyses.find((a) => a.sessionId === s.id);
          const convs = conventions.filter((c) => c.sessionId === s.id);
          return (
            <article key={s.id} id={`besoin-${s.id}`} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg">{s.name}</h3>
                  <p className="text-sm text-slate-500">
                    {s.course.title} · {s.format === "INTRA" ? "Intra-entreprise" : "Inter-entreprises"} · du {formatDate(s.startDate)} au {formatDate(s.endDate)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {[s.address, [s.postalCode, s.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || s.location || "Lieu communiqué dans la convocation"}
                    {s.room ? ` · salle ${s.room}` : ""}{s.trainer ? ` · formateur : ${s.trainer.name}` : ""}
                  </p>
                  {s.accessInfo && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{s.accessInfo}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {convs.map((c) => (
                    <Link key={c.id} href={`/entreprise/conventions/${c.id}`}>
                      <Badge tone={c.status === "SIGNED" ? "green" : "amber"}>{c.status === "SIGNED" ? `Convention ${c.reference} signée` : `Convention ${c.reference} à signer`}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
              <details className="mt-4 rounded-[10px] border border-slate-200 p-4" open={!na && s.endDate >= now}>
                <summary className="cursor-pointer font-medium text-brand-600">
                  Vos besoins et attentes {na?.validatedAt ? "(pris en compte par l'organisme)" : na ? "(transmis)" : "(à compléter)"}
                </summary>
                {na?.validatedAt ? (
                  <dl className="mt-3 space-y-2 text-sm">
                    <div><dt className="font-medium">Contexte</dt><dd className="whitespace-pre-line text-slate-600">{na.context}</dd></div>
                    <div><dt className="font-medium">Objectifs</dt><dd className="whitespace-pre-line text-slate-600">{na.objectives}</dd></div>
                    {na.adaptations && <div><dt className="font-medium">Adaptations proposées par l&apos;organisme</dt><dd className="whitespace-pre-line text-slate-600">{na.adaptations}</dd></div>}
                  </dl>
                ) : (
                  <StateForm action={saveNeedsAnalysisAction.bind(null, company.id, s.id)} submitLabel="Envoyer mes besoins" submitClassName="btn-primary" className="mt-3 space-y-3">
                    <Field label="Contexte : pourquoi cette formation, pour quels salariés ?"><textarea name="context" rows={3} required defaultValue={na?.context ?? ""} className="input" /></Field>
                    <Field label="Objectifs attendus à l'issue de la formation"><textarea name="objectives" rows={3} required defaultValue={na?.objectives ?? ""} className="input" /></Field>
                    <Field label="Contraintes : dates, lieu, niveau, situation de handicap à anticiper…"><textarea name="constraints" rows={2} defaultValue={na?.constraints ?? ""} className="input" /></Field>
                  </StateForm>
                )}
              </details>
            </article>
          );
        })}
      </section>

      <section className="card mt-6 p-6 text-sm">
        <h2 className="text-xl">Votre organisme de formation</h2>
        <p className="mt-2 text-slate-600">
          {company.organization.name}
          {company.organization.email && <> · <a href={`mailto:${company.organization.email}`} className="link">{company.organization.email}</a></>}
          {company.organization.phone && <> · {company.organization.phone}</>}
        </p>
        <p className="mt-2 text-xs text-slate-500">Les informations affichées sur vos salariés sont limitées à ce que l&apos;organisme a choisi de partager, conformément au RGPD.</p>
      </section>
    </Container>
  );
}
