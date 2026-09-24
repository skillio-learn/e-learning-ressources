import { requireStaff, isOfManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { NavLink } from "@/components/NavLink";

export default async function OfLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const manager = isOfManager(user);
  const [org, pendingApps, pendingGrading] = await Promise.all([
    user.organizationId ? db.organization.findUnique({ where: { id: user.organizationId }, select: { name: true } }) : null,
    manager
      ? db.application.count({
          where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, ...(user.role === "ADMIN" ? {} : { course: { organizationId: user.organizationId ?? "__" } }) },
        })
      : Promise.resolve(0),
    db.submission.count({
      where: { status: "SUBMITTED", ...(user.role === "ADMIN" ? {} : { lesson: { module: { course: { organizationId: user.organizationId ?? "__" } } } }) },
    }),
  ]);
  const Item = ({ href, children, count }: { href: string; children: React.ReactNode; count?: number }) => (
    <div className="relative">
      <NavLink href={href}>{children}</NavLink>
      {count ? (
        <span className="pointer-events-none absolute right-2 top-1.5 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{count}</span>
      ) : null}
    </div>
  );
  return (
    <div className="mx-auto flex max-w-[1500px] flex-col lg:flex-row">
      <aside className="no-print border-b border-slate-200 bg-white lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Espace OF</div>
          <div className="text-sm font-semibold text-slate-800">{user.role === "ADMIN" ? "Tous les organismes" : org?.name ?? "—"}</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-2 text-sm lg:flex-col [&_a]:block">
          <Item href="/of/home">🏠 Tableau de bord</Item>
          {manager && <Item href="/of/applications" count={pendingApps}>📥 Dossiers d&apos;inscription</Item>}
          <Item href="/of/learners">👥 Apprenants</Item>
          <Item href="/of/courses">📚 Formations</Item>
          <Item href="/of/sessions">📅 Sessions & émargement</Item>
          <Item href="/of/grading" count={pendingGrading}>📝 Corrections</Item>
          <Item href="/of/rubrics">📋 Grilles d&apos;évaluation</Item>
          {manager && <Item href="/of/reports">📊 Rapports & traçabilité</Item>}
          {manager && <Item href="/of/quality">⭐ Qualité & réclamations</Item>}
          {manager && <Item href="/of/audit">🔍 Journal d&apos;audit</Item>}
          {manager && <Item href="/of/team">🧑‍🏫 Équipe</Item>}
          {manager && user.role !== "ADMIN" && <Item href="/of/settings">⚙️ Paramètres de l&apos;OF</Item>}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
