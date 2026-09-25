import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isOfManager, requireStaff } from "@/lib/auth";
import { canViewLearner, manageableCoursesWhere } from "@/lib/permissions";
import { updateEnrollmentAction } from "@/app/actions/of-admin";
import { createFunderFeedbackAction, requestColdEvaluationAction, sendConvocationAction } from "@/app/actions/compliance";
import { ofResetLearnerPasswordAction } from "@/app/actions/password";
import { enrollLearnerInCourseAction } from "@/app/actions/access";
import { openApplicationForLearnerAction } from "@/app/actions/applications";
import { ACCESS_STATUS, ACCOUNT_STATUS } from "@/lib/labels";
import { SubmitButton } from "@/components/SubmitButton";
import { StateForm } from "@/components/StateForm";
import { StatusBadge } from "@/components/applications/StatusBadge";
import { Badge, Container, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { EMPLOYMENT_STATUS, ENROLLMENT_STATUS, EXIT_REASONS, FUNDING_TYPES, RESPONDENT_TYPES, SKILL_LEVELS, formatDuration, formatHours } from "@/lib/labels";
import { getCourseOutline } from "@/lib/progress";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fiche apprenant" };

const EVENT_LABEL = { LOGIN: "Connexion", LOGOUT: "Déconnexion", FAILED: "Échec", LOCKED: "Verrouillé" } as const;

export default async function LearnerFile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff();
  if (!(await canViewLearner(user, id))) notFound();
  const manager = isOfManager(user);
  const courseWhere = manageableCoursesWhere(user);
  const learner = await db.user.findUnique({
    where: { id },
    include: {
      profile: true,
      enrollments: {
        where: { course: courseWhere },
        include: {
          session: { select: { name: true } },
          enrolledBy: { select: { name: true } },
          application: { select: { id: true, number: true, positioning: true } },
          feedbacks: { orderBy: { createdAt: "desc" } },
          course: { select: { id: true, title: true, skills: true, sessions: { select: { id: true, name: true } } } },
          satisfactions: { select: { globalScore: true, kind: true } },
        },
      },
      applications: { where: { course: courseWhere }, include: { course: { select: { title: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!learner) notFound();
  const courseIds = learner.enrollments.map((e) => e.courseId);
  const [logins, sessions, timeByCourse, outlines] = await Promise.all([
    db.loginEvent.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.activitySession.findMany({ where: { userId: id }, orderBy: { startedAt: "desc" }, take: 50 }),
    db.timeLog.groupBy({ by: ["courseId"], where: { userId: id, courseId: { in: courseIds } }, _sum: { seconds: true }, _max: { endedAt: true } }),
    Promise.all(learner.enrollments.map((e) => getCourseOutline(e.courseId, id, { ignoreLocks: true }))),
  ]);
  const timeMap = new Map(timeByCourse.map((t) => [t.courseId, t]));
  const totalSec = timeByCourse.reduce((s, t) => s + (t._sum.seconds ?? 0), 0);
  const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
  const enrollable = manager
    ? await db.course.findMany({
        where: { ...courseWhere, status: "PUBLISHED", id: { notIn: courseIds } },
        select: { id: true, title: true, sessions: { where: { open: true }, select: { id: true, name: true } } },
        orderBy: { title: "asc" },
      })
    : [];
  const acc = ACCOUNT_STATUS[learner.accountStatus];
  const p = learner.profile;

  return (
    <Container>
      <PageHeader
        back={{ href: "/of/learners", label: "Apprenants" }}
        title={learner.name}
                subtitle={`${learner.email}${p?.phone ? ` · ${p.phone}` : ""} · compte créé le ${formatDate(learner.createdAt)}`}
        actions={
          manager ? (
            <>
            <Link href={`/of/accounts/${id}`} className="inline-flex"><Badge tone={acc.tone}>Compte : {acc.label}</Badge></Link>
            <StateForm action={ofResetLearnerPasswordAction.bind(null, id)} submitLabel="Réinitialiser le mot de passe" submitClassName="btn-secondary btn-sm" className="max-w-xs space-y-2">
              <></>
            </StateForm>
            </>
          ) : null
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Temps de formation total" value={formatHours(totalSec)} hint={formatDuration(totalSec)} />
        <Stat label="Connexions" value={logins.filter((l) => l.type === "LOGIN").length} hint="50 derniers évènements" />
        <Stat label="Dernière connexion" value={<span className="text-base">{formatDate(learner.lastLoginAt, true)}</span>} />
        <Stat label="Formations" value={learner.enrollments.length} />
      </div>

      <section className="space-y-4">
        <h2>Inscriptions & suivi</h2>
        {manager && enrollable.length > 0 && (
          <details className="card p-5">
            <summary className="cursor-pointer font-medium text-slate-900">Inscrire à une formation</summary>
            <p className="mt-1 text-xs text-slate-500">L&apos;apprenant est notifié et doit fournir ses documents d&apos;inscription ; vous ouvrez ensuite son accès.</p>
            <StateForm action={enrollLearnerInCourseAction.bind(null, id)} submitLabel="Inscrire" submitClassName="btn-primary self-end" className="mt-3 grid gap-3 md:grid-cols-5">
              <label className="text-sm md:col-span-2"><span className="label">Formation *</span>
                <select name="courseId" required className="input">
                  {enrollable.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </label>
              <label className="text-sm"><span className="label">Session</span>
                <select name="sessionId" className="input">
                  <option value="">—</option>
                  {enrollable.flatMap((c) => c.sessions.map((s) => <option key={s.id} value={s.id}>{c.title.slice(0, 20)}… · {s.name}</option>))}
                </select>
              </label>
              <label className="text-sm"><span className="label">Début</span><input type="date" name="startDate" className="input" /></label>
              <label className="text-sm"><span className="label">Fin</span><input type="date" name="endDate" className="input" /></label>
              <label className="text-sm"><span className="label">Heures prévues</span><input type="number" step="0.5" name="plannedHours" className="input" /></label>
            </StateForm>
          </details>
        )}
        {manager && enrollable.length > 0 && (
          <details className="card p-5">
            <summary className="cursor-pointer font-medium text-slate-900">Ouvrir un dossier de candidature</summary>
            <p className="mt-1 text-xs text-slate-500">L&apos;apprenant complète son dossier (informations, financement, justificatifs) ; vous le validez puis l&apos;inscrivez depuis « Dossiers de candidature ».</p>
            <StateForm action={openApplicationForLearnerAction.bind(null, id)} submitLabel="Ouvrir le dossier" submitClassName="btn-secondary self-end" className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="text-sm md:col-span-2"><span className="label">Formation *</span>
                <select name="courseId" required className="input">
                  {enrollable.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </label>
            </StateForm>
          </details>
        )}
        {learner.enrollments.map((e, i) => {
          const o = outlines[i];
          const t = timeMap.get(e.courseId);
          return (
            <div key={e.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{e.course.title}</div>
                  <div className="text-xs text-slate-500">
                    {e.application ? `Dossier ${e.application.number} · ` : ""}Inscrit le {formatDate(e.enrolledAt)}
                    {e.enrolledBy ? ` par ${e.enrolledBy.name}` : ""} · {e.session?.name ?? "sans session"}
                    {e.fundingType ? ` · ${FUNDING_TYPES[e.fundingType].split(" (")[0]}` : ""}
                    {e.satisfactions.map((x) => ` · satisfaction ${x.kind === "COLD" ? "à froid" : "à chaud"} ${x.globalScore}/5`).join("")}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/of/access/${e.id}`}><Badge tone={ACCESS_STATUS[e.accessStatus].tone}>{ACCESS_STATUS[e.accessStatus].label}</Badge></Link>
                  <Badge tone={ENROLLMENT_STATUS[e.status].tone}>{ENROLLMENT_STATUS[e.status].label}</Badge>
                </div>
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-500">Progression</div>
                  <ProgressBar value={o?.percent ?? 0} className="mt-1" />
                  <div className="text-xs">{o?.completed}/{o?.total} étapes · {o?.percent}%</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Temps réalisé / prévu</div>
                  <div className="font-semibold">{formatHours(t?._sum.seconds)} {e.plannedHours ? `/ ${e.plannedHours} h` : ""}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Dernière activité</div>
                  <div className="text-sm">{formatDate(t?._max.endedAt ?? e.lastActivityAt, true)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Période</div>
                  <div className="text-sm">{formatDate(e.startDate)} → {formatDate(e.endDate)}</div>
                </div>
              </div>
                            {e.exitDate && (
                <div className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-800">
                  Sortie le {formatDate(e.exitDate)} — {EXIT_REASONS[e.exitCategory ?? ""] ?? e.exitCategory}{e.exitReason ? ` : ${e.exitReason}` : ""}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                {e.conventionSignedAt ? (
                  <Badge tone="green">Convention signée le {formatDate(e.conventionSignedAt, true)}</Badge>
                ) : (
                  <Badge tone="amber">Convention non signée</Badge>
                )}
                {e.convocationSentAt ? <Badge tone="green">Convocation envoyée le {formatDate(e.convocationSentAt)}</Badge> : <Badge>Convocation non envoyée</Badge>}
                {manager && (
                  <form action={sendConvocationAction.bind(null, e.id)} className="inline">
                    <SubmitButton className="btn-ghost btn-sm" pendingLabel="Envoi…">{e.convocationSentAt ? "Renvoyer la convocation" : "Envoyer la convocation"}</SubmitButton>
                  </form>
                )}
              </div>
              {e.course.skills.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-slate-500"><th className="py-1">Compétence visée</th><th>Positionnement d&apos;entrée</th><th>Auto-évaluation de sortie</th><th>Évolution</th></tr></thead>
                    <tbody>
                      {e.course.skills.map((s) => {
                        const inV = (e.application?.positioning as Record<string, number> | null)?.[s];
                        const outV = (e.exitAssessment as Record<string, number> | null)?.[s];
                        return (
                          <tr key={s} className="border-t border-slate-100">
                            <td className="py-1">{s}</td>
                            <td>{inV !== undefined ? SKILL_LEVELS[inV] : "—"}</td>
                            <td>{outV !== undefined ? SKILL_LEVELS[outV] : "—"}</td>
                            <td>{inV !== undefined && outV !== undefined ? (outV - inV > 0 ? `+${outV - inV} ▲` : outV - inV === 0 ? "=" : `${outV - inV} ▼`) : ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/documents/convention/${e.id}`} className="btn-secondary btn-sm">Convention / contrat</Link>
                <Link href={`/documents/convocation/${e.id}`} className="btn-secondary btn-sm">Convocation</Link>
                <Link href={`/of/messages/${e.id}`} className="btn-secondary btn-sm">Messages</Link>
                <Link href={`/documents/releve/${e.id}`} className="btn-secondary btn-sm">Relevé de connexions</Link>
                <Link href={`/documents/assiduite/${e.id}`} className="btn-secondary btn-sm">Attestation d&apos;assiduité</Link>
                <Link href={`/documents/realisation/${e.id}`} className="btn-secondary btn-sm">Certificat de réalisation</Link>
                <a href={`/api/pdf/enrollments/${e.id}/realisation`} className="btn-secondary btn-sm">Certificat (PDF)</a>
                <a href={`/api/pdf/enrollments/${e.id}/releve`} className="btn-secondary btn-sm">Relevé (PDF)</a>
                <a href={`/api/of/reports/timelogs?enrollment=${e.id}`} className="btn-secondary btn-sm">⬇ Détail des temps (CSV)</a>
                <Link href={`/of/courses/${e.courseId}/learners/${id}`} className="btn-ghost btn-sm">Détail pédagogique →</Link>
              </div>
              {manager && (
                <details className="mt-4 rounded-lg bg-slate-50 p-3">
                  <summary className="cursor-pointer text-sm font-medium">Modifier l&apos;inscription (dates, heures, financement, statut)</summary>
                  <StateForm action={updateEnrollmentAction.bind(null, e.id)} className="mt-3 grid gap-3 md:grid-cols-4" submitClassName="btn-primary self-end">
                    <label className="text-sm"><span className="label">Début</span><input type="date" name="startDate" defaultValue={iso(e.startDate)} className="input" /></label>
                    <label className="text-sm"><span className="label">Fin</span><input type="date" name="endDate" defaultValue={iso(e.endDate)} className="input" /></label>
                    <label className="text-sm"><span className="label">Heures prévues</span><input type="number" step="0.5" name="plannedHours" defaultValue={e.plannedHours ?? ""} className="input" /></label>
                    <label className="text-sm">
                      <span className="label">Statut</span>
                      <select name="status" defaultValue={e.status} className="input">
                        <option value="ACTIVE">En cours</option>
                        <option value="COMPLETED">Terminée</option>
                                                <option value="SUSPENDED">Interrompue</option>
                        <option value="ABANDONED">Abandon</option>
                      </select>
                    </label>
                    <label className="text-sm"><span className="label">Date de sortie (abandon / interruption)</span><input type="date" name="exitDate" defaultValue={iso(e.exitDate)} className="input" /></label>
                    <label className="text-sm">
                      <span className="label">Motif de sortie</span>
                      <select name="exitCategory" defaultValue={e.exitCategory ?? ""} className="input">
                        <option value="">—</option>
                        {Object.entries(EXIT_REASONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </label>
                    <label className="text-sm md:col-span-2"><span className="label">Précisions</span><input name="exitReason" defaultValue={e.exitReason ?? ""} className="input" /></label>
                    <label className="text-sm">
                      <span className="label">Financement</span>
                      <select name="fundingType" defaultValue={e.fundingType ?? ""} className="input">
                        <option value="">—</option>
                        {Object.entries(FUNDING_TYPES).map(([v, l]) => <option key={v} value={v}>{l.split(" (")[0]}</option>)}
                      </select>
                    </label>
                    <label className="text-sm"><span className="label">N° prise en charge</span><input name="fundingReference" defaultValue={e.fundingReference ?? ""} className="input" /></label>
                    <label className="text-sm">
                      <span className="label">Session</span>
                      <select name="sessionId" defaultValue={e.sessionId ?? ""} className="input">
                        <option value="">—</option>
                        {e.course.sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </label>
                  </StateForm>
                                </details>
              )}
              {manager && (
                <details className="mt-3 rounded-lg bg-slate-50 p-3">
                  <summary className="cursor-pointer text-sm font-medium">Évaluations qualité (à froid, financeur, entreprise)</summary>
                  <div className="mt-3 flex flex-wrap items-start gap-4">
                    <form action={requestColdEvaluationAction.bind(null, e.id)}>
                      <SubmitButton className="btn-secondary btn-sm" pendingLabel="Envoi…">Demander l&apos;évaluation à froid</SubmitButton>
                    </form>
                    <StateForm action={createFunderFeedbackAction.bind(null, e.id)} submitLabel="Générer le lien" submitClassName="btn-secondary btn-sm" className="flex flex-wrap items-center gap-2">
                      <select name="respondentType" className="input w-auto py-1 text-sm">
                        {Object.entries(RESPONDENT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <input name="respondentName" placeholder="Nom / structure" className="input w-48 py-1 text-sm" />
                    </StateForm>
                  </div>
                  {e.feedbacks.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs">
                      {e.feedbacks.map((f) => (
                        <li key={f.id}>
                          {RESPONDENT_TYPES[f.respondentType]} {f.respondentName ? `(${f.respondentName})` : ""} —{" "}
                          {f.answeredAt ? <b>répondu : {f.globalScore}/5</b> : <span>en attente · lien : <code>/feedback/{f.token}</code></span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              )}
            </div>
          );
        })}
        {learner.enrollments.length === 0 && <p className="text-sm text-slate-500">Aucune inscription définitive.</p>}
      </section>

      {manager && learner.applications.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3">Dossiers de candidature</h2>
          <div className="card divide-y divide-slate-100">
            {learner.applications.map((a) => (
              <Link key={a.id} href={`/of/applications/${a.id}`} className="flex items-center justify-between p-3 text-sm hover:bg-slate-50">
                <span><span className="font-mono text-xs">{a.number}</span> · {a.course.title}</span>
                <StatusBadge status={a.status} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {manager && p && (
        <section className="card mt-8 p-5 text-sm">
          <h2 className="mb-3">Informations administratives</h2>
          <div className="grid gap-2 md:grid-cols-3">
            <div>Né(e) le {formatDate(p.birthDate)} à {p.birthPlace ?? "—"}</div>
            <div>{p.address}, {p.postalCode} {p.city}</div>
            <div>{p.employmentStatus ? EMPLOYMENT_STATUS[p.employmentStatus] : "—"}{p.franceTravailId ? ` · FT ${p.franceTravailId}` : ""}</div>
            <div>{p.educationLevel ?? "—"}</div>
            <div>{p.employerName ? `Employeur : ${p.employerName} (${p.employerSiret ?? "—"})` : ""}</div>
            <div>{p.disability ? `Aménagements : ${p.disabilityNeeds ?? "à définir"}` : ""}</div>
          </div>
        </section>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2>Journal de connexion</h2>
            {manager && <a href={`/api/of/reports/logins?user=${id}`} className="btn-ghost btn-sm">⬇ CSV</a>}
          </div>
          <table className="table">
            <thead><tr><th>Date</th><th>Évènement</th><th>IP</th><th>Navigateur</th></tr></thead>
            <tbody>
              {logins.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-xs">{formatDate(l.createdAt, true)}</td>
                  <td>{l.type === "FAILED" || l.type === "LOCKED" ? <Badge tone="red">{EVENT_LABEL[l.type]}</Badge> : EVENT_LABEL[l.type]}</td>
                  <td className="text-xs">{l.ip ?? "—"}</td>
                  <td className="max-w-[180px] truncate text-xs text-slate-400" title={l.userAgent ?? ""}>{l.userAgent ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2>Sessions de travail (temps actif)</h2>
            {manager && <a href={`/api/of/reports/sessions?user=${id}`} className="btn-ghost btn-sm">⬇ CSV</a>}
          </div>
          <table className="table">
            <thead><tr><th>Début</th><th>Fin / dernier signal</th><th>Temps actif</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap text-xs">{formatDate(s.startedAt, true)}</td>
                  <td className="whitespace-nowrap text-xs">{formatDate(s.endedAt ?? s.lastSeenAt, true)}{!s.endedAt && " (en cours)"}</td>
                  <td>{formatDuration(s.activeSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Container>
  );
}
