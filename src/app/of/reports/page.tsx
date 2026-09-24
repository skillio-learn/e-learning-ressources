import Link from "next/link";
import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { manageableCoursesWhere } from "@/lib/permissions";
import { dateParam, learnersSummary } from "@/lib/reports";
import { Badge, Container, Empty, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { formatHours } from "@/lib/labels";
import { formatDate, pct } from "@/lib/utils";

export const metadata = { title: "Rapports & traçabilité" };
export const dynamic = "force-dynamic";

export default async function Reports({ searchParams }: { searchParams: Promise<{ course?: string; from?: string; to?: string }> }) {
  const user = await requireOfManager();
  const sp = await searchParams;
  const courses = await db.course.findMany({ where: manageableCoursesWhere(user), select: { id: true, title: true }, orderBy: { title: "asc" } });
  const ids = sp.course && courses.some((c) => c.id === sp.course) ? [sp.course] : courses.map((c) => c.id);
  const from = dateParam(sp.from);
  const to = dateParam(sp.to, true);
  const rows = await learnersSummary(ids, from, to);
  const totalSec = rows.reduce((s, r) => s + r.seconds, 0);
  const planned = rows.reduce((s, r) => s + (r.enrollment.plannedHours ?? 0), 0);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const exp = (kind: string) => `/api/of/reports/${kind}${qs ? `?${qs}` : ""}`;

  return (
    <Container>
      <PageHeader
        title="Rapports & traçabilité"
        subtitle="Éléments de preuve pour les contrôles OPCO, France Travail, Caisse des dépôts (CPF) et Qualiopi : temps de connexion, assiduité, progression."
      />
      <form className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">
          <span className="label">Formation</span>
          <select name="course" defaultValue={sp.course ?? ""} className="input">
            <option value="">Toutes les formations</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="label">Du</span><input type="date" name="from" defaultValue={sp.from} className="input" /></label>
        <label className="text-sm"><span className="label">Au</span><input type="date" name="to" defaultValue={sp.to} className="input" /></label>
        <button className="btn-primary">Appliquer</button>
        <Link href="/of/reports" className="btn-ghost">Réinitialiser</Link>
      </form>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Inscriptions" value={rows.length} />
        <Stat label="Heures réalisées" value={formatHours(totalSec)} hint={planned ? `sur ${planned} h prévues` : undefined} />
        <Stat label="Assiduité globale" value={planned ? pct((totalSec / 3600 / planned) * 100) : "—"} />
        <Stat label="Progression moyenne" value={rows.length ? pct(rows.reduce((s, r) => s + r.percent, 0) / rows.length) : "—"} />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <a href={exp("summary")} className="btn-primary">⬇ Synthèse assiduité (CSV)</a>
        <a href={exp("logins")} className="btn-secondary">⬇ Journal des connexions (CSV)</a>
        <a href={exp("sessions")} className="btn-secondary">⬇ Sessions de travail (CSV)</a>
        <a href={exp("timelogs")} className="btn-secondary">⬇ Temps détaillé par leçon (CSV)</a>
        <a href={exp("audit")} className="btn-secondary">⬇ Journal d&apos;audit (CSV)</a>
      </div>

      {rows.length === 0 ? (
        <Empty title="Aucune inscription sur ce périmètre" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Apprenant</th><th>Formation</th><th>Période</th><th>Réalisé / prévu</th><th>Assiduité</th><th>Progression</th><th>Connexions</th><th>Dernière activité</th><th>Documents</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rate = r.enrollment.plannedHours ? (r.seconds / 3600 / r.enrollment.plannedHours) * 100 : null;
                return (
                  <tr key={r.enrollment.id}>
                    <td><Link href={`/of/learners/${r.enrollment.user.id}`} className="font-medium hover:text-brand-700">{r.enrollment.user.name}</Link></td>
                    <td className="text-xs">{r.enrollment.course.title}</td>
                    <td className="whitespace-nowrap text-xs">{formatDate(r.enrollment.startDate)} → {formatDate(r.enrollment.endDate)}</td>
                    <td className="whitespace-nowrap">{formatHours(r.seconds)}{r.enrollment.plannedHours ? ` / ${r.enrollment.plannedHours} h` : ""}</td>
                    <td>{rate === null ? "—" : <Badge tone={rate >= 80 ? "green" : rate >= 50 ? "amber" : "red"}>{pct(rate)}</Badge>}</td>
                    <td className="w-32"><ProgressBar value={r.percent} /><span className="text-xs">{r.percent} %</span></td>
                    <td>{r.logins}</td>
                    <td className="text-xs">{formatDate(r.lastActivity, true)}</td>
                    <td className="whitespace-nowrap text-xs">
                      <Link href={`/documents/releve/${r.enrollment.id}`} className="text-brand-600 hover:underline">Relevé</Link> ·{" "}
                      <Link href={`/documents/assiduite/${r.enrollment.id}`} className="text-brand-600 hover:underline">Assiduité</Link> ·{" "}
                      <Link href={`/documents/realisation/${r.enrollment.id}`} className="text-brand-600 hover:underline">Réalisation</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
