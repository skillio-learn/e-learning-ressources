import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { manageableCoursesWhere, orgFilter } from "@/lib/permissions";
import { respondComplaintAction } from "@/app/actions/of-admin";
import { StateForm } from "@/components/StateForm";
import { Badge, Container, PageHeader, Stat } from "@/components/ui";
import { COMPLAINT_STATUS, RESPONDENT_TYPES, SATISFACTION_QUESTIONS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Qualité" };
export const dynamic = "force-dynamic";

export default async function Quality() {
  const user = await requireOfManager();
  const courseIds = (await db.course.findMany({ where: manageableCoursesWhere(user), select: { id: true } })).map((c) => c.id);
    const [responses, complaints, funders] = await Promise.all([
    db.satisfactionResponse.findMany({
      where: { enrollment: { courseId: { in: courseIds } } },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } }, enrollment: { select: { course: { select: { title: true } } } } },
    }),
    db.complaint.findMany({
      where: orgFilter(user),
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
            include: { user: { select: { name: true, email: true } }, course: { select: { title: true } }, handledBy: { select: { name: true } } },
    }),
    db.funderFeedback.findMany({
      where: orgFilter(user),
      orderBy: { createdAt: "desc" },
      include: { enrollment: { select: { user: { select: { name: true } }, course: { select: { title: true } } } } },
    }),
  ]);
  const hot = responses.filter((r) => r.kind === "HOT");
  const cold = responses.filter((r) => r.kind === "COLD");
  const avgOf = (list: { globalScore: number | null }[]) => {
    const v = list.filter((x) => x.globalScore != null);
    return v.length ? (v.reduce((s, x) => s + (x.globalScore ?? 0), 0) / v.length).toFixed(2) : "—";
  };
  const answeredFunders = funders.filter((f) => f.answeredAt);
  const avg = (code: string) => {
    const vals = responses.map((r) => (r.answers as Record<string, number>)[code]).filter((v) => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const global = responses.length ? responses.reduce((s, r) => s + r.globalScore, 0) / responses.length : null;
  const recommend = responses.filter((r) => r.recommend !== null);
  return (
    <Container>
      <PageHeader title="Qualité : satisfaction & réclamations" subtitle="Indicateurs Qualiopi 30 (recueil des appréciations) et 31 (traitement des réclamations)." />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
                <Stat label="Satisfaction à chaud" value={`${avgOf(hot)} / 5`} hint={`${hot.length} réponse(s) · à froid : ${avgOf(cold)} / 5 (${cold.length})`} />
        <Stat label="Financeurs / entreprises" value={`${avgOf(answeredFunders)} / 5`} hint={`${answeredFunders.length} réponse(s) sur ${funders.length} demande(s)`} />
        <Stat label="Recommanderaient" value={recommend.length ? `${Math.round((recommend.filter((r) => r.recommend).length / recommend.length) * 100)} %` : "—"} />
        <Stat label="Réclamations ouvertes" value={complaints.filter((c) => c.status !== "RESOLVED").length} />
        <Stat label="Réclamations traitées" value={complaints.filter((c) => c.status === "RESOLVED").length} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3">Satisfaction par critère</h2>
          <table className="table">
            <tbody>
              {SATISFACTION_QUESTIONS.map((q) => {
                const v = avg(q.code);
                return (
                  <tr key={q.code}>
                    <td>{q.label}</td>
                    <td className="w-40">
                      <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${((v ?? 0) / 5) * 100}%` }} /></div>
                    </td>
                    <td className="w-16 text-right font-semibold">{v ? v.toFixed(1) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <h3 className="mb-2 mt-5 font-semibold">Derniers commentaires</h3>
          <ul className="space-y-2 text-sm">
            {responses.filter((r) => r.comment).slice(0, 15).map((r) => (
              <li key={r.id} className="rounded-lg bg-slate-50 p-2">
                <div className="text-xs text-slate-500">{r.user.name} · {r.enrollment.course.title} · {r.globalScore}/5 · {formatDate(r.createdAt)}</div>
                <p className="mt-1">« {r.comment} »</p>
              </li>
            ))}
            {responses.every((r) => !r.comment) && <li className="text-slate-500">Aucun commentaire.</li>}
          </ul>
        </section>
                <section className="space-y-3">
          <h2>Évaluations financeurs & entreprises</h2>
          {funders.length === 0 && <p className="text-sm text-slate-500">Générez un lien d&apos;évaluation depuis la fiche d&apos;un apprenant.</p>}
          {funders.map((f) => (
            <div key={f.id} className="card p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>
                  <b>{RESPONDENT_TYPES[f.respondentType]}</b> {f.respondentName ? `· ${f.respondentName}` : ""}
                  {f.enrollment ? <span className="text-slate-500"> · {f.enrollment.user.name} – {f.enrollment.course.title}</span> : null}
                </span>
                {f.answeredAt ? <Badge tone="green">{f.globalScore}/5</Badge> : <Badge>En attente</Badge>}
              </div>
              {f.comment && <p className="mt-1 text-slate-600">« {f.comment} »</p>}
            </div>
          ))}
          <h2 className="pt-4">Réclamations & demandes</h2>
          {complaints.length === 0 && <p className="text-sm text-slate-500">Aucune réclamation.</p>}
          {complaints.map((c) => (
            <div key={c.id} id={c.id} className="card p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-500">{c.category} · {c.user.name} ({c.user.email}) · {formatDate(c.createdAt, true)}{c.course ? ` · ${c.course.title}` : ""}</div>
                  <div className="font-semibold">{c.subject}</div>
                </div>
                <Badge tone={COMPLAINT_STATUS[c.status].tone}>{COMPLAINT_STATUS[c.status].label}</Badge>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-slate-700">{c.message}</p>
              {c.handledBy && <p className="mt-1 text-xs text-slate-400">Traité par {c.handledBy.name}{c.resolvedAt ? ` le ${formatDate(c.resolvedAt)}` : ""}</p>}
              <StateForm action={respondComplaintAction.bind(null, c.id)} submitLabel="Enregistrer" submitClassName="btn-primary btn-sm" className="mt-3 space-y-2">
                <textarea name="response" rows={3} defaultValue={c.response ?? ""} className="input" placeholder="Réponse et actions correctives" />
                <select name="status" defaultValue={c.status === "OPEN" ? "IN_PROGRESS" : c.status} className="input w-auto">
                  <option value="OPEN">Ouverte</option>
                  <option value="IN_PROGRESS">En cours de traitement</option>
                  <option value="RESOLVED">Résolue (réponse envoyée)</option>
                </select>
              </StateForm>
            </div>
          ))}
        </section>
      </div>
    </Container>
  );
}
