import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isOfManager, requireStaff } from "@/lib/auth";
import { canViewLearner, manageableCoursesWhere } from "@/lib/permissions";
import { updateEnrollmentAction } from "@/app/actions/of-admin";
import { StateForm } from "@/components/StateForm";
import { StatusBadge } from "@/components/applications/StatusBadge";
import { Badge, Container, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { EMPLOYMENT_STATUS, FUNDING_TYPES, formatDuration, formatHours } from "@/lib/labels";
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
          course: { select: { id: true, title: true, sessions: { select: { id: true, name: true } } } },
          session: { select: { name: true } },
          enrolledBy: { select: { name: true } },
          application: { select: { id: true, number: true } },
          satisfaction: { select: { globalScore: true } },
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
  const p = learner.profile;

  return (
    <Container>
      <PageHeader
        back={{ href: "/of/learners", label: "Apprenants" }}
        title={learner.name}
        subtitle={`${learner.email}${p?.phone ? ` · ${p.phone}` : ""} · compte créé le ${formatDate(learner.createdAt)}`}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Temps de formation total" value={formatHours(totalSec)} hint={formatDuration(totalSec)} />
        <Stat label="Connexions" value={logins.filter((l) => l.type === "LOGIN").length} hint="50 derniers évènements" />
        <Stat label="Dernière connexion" value={<span className="text-base">{formatDate(learner.lastLoginAt, true)}</span>} />
        <Stat label="Formations" value={learner.enrollments.length} />
      </div>

      <section className="space-y-4">
        <h2>Inscriptions & suivi</h2>
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
                    {e.satisfaction ? ` · satisfaction ${e.satisfaction.globalScore}/5` : ""}
                  </div>
                </div>
                <Badge tone={e.status === "COMPLETED" ? "green" : e.status === "SUSPENDED" ? "red" : "blue"}>
                  {e.status === "COMPLETED" ? "Terminée" : e.status === "SUSPENDED" ? "Suspendue" : "En cours"}
                </Badge>
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
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/documents/releve/${e.id}`} className="btn-secondary btn-sm">🕒 Relevé de connexions</Link>
                <Link href={`/documents/assiduite/${e.id}`} className="btn-secondary btn-sm">📄 Attestation d&apos;assiduité</Link>
                <Link href={`/documents/realisation/${e.id}`} className="btn-secondary btn-sm">🧾 Certificat de réalisation</Link>
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
                        <option value="SUSPENDED">Suspendue</option>
                      </select>
                    </label>
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
            <div>{p.disability ? `♿ Aménagements : ${p.disabilityNeeds ?? "à définir"}` : ""}</div>
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
