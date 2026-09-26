import { requireStaff, isOfManager } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  BadgeCheck, BarChart3, BookOpen, Building2, CheckSquare, GraduationCap, Newspaper, CalendarDays, ClipboardList, Headset, Home, Inbox, KeyRound, LifeBuoy, MessagesSquare, PenLine, ScrollText, Settings, Star, UserCheck, Users, UserCog,
} from "lucide-react";
import { SideLink } from "@/components/NavLink";
import { canManageQuality } from "@/lib/qualiopi-evidence";

export default async function OfLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const manager = isOfManager(user);
  const orgScope = user.role === "ADMIN" ? {} : { organizationId: user.organizationId ?? "__none__" };
  const [pendingAccounts, pendingAccess, openSupport] = await Promise.all([
    manager
      ? Promise.all([
          db.user.count({ where: { role: "LEARNER", accountStatus: "PENDING_REVIEW", ...orgScope } }),
          db.profileChangeRequest.count({ where: { status: "PENDING", user: orgScope } }),
        ]).then(([a, b]) => a + b)
      : Promise.resolve(0),
    manager ? db.enrollment.count({ where: { accessStatus: "UNDER_REVIEW", ...(user.role === "ADMIN" ? {} : { course: orgScope }) } }) : Promise.resolve(0),
    db.supportConversation.count({ where: { status: "OPEN", ...orgScope } }),
  ]);
  const ticketReplies =
    user.role === "OF_ADMIN" && user.organizationId
      ? await db.supportTicketMessage.count({ where: { fromAdmin: true, internal: false, system: false, readAt: null, ticket: { organizationId: user.organizationId } } })
      : 0;
  const [org, pendingApps, pendingGrading, unreadMessages] = await Promise.all([
    user.organizationId ? db.organization.findUnique({ where: { id: user.organizationId }, select: { name: true } }) : null,
    manager
      ? db.application.count({
          where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, ...(user.role === "ADMIN" ? {} : { course: { organizationId: user.organizationId ?? "__" } }) },
        })
      : Promise.resolve(0),
    db.submission.count({
            where: { status: "SUBMITTED", ...(user.role === "ADMIN" ? {} : { lesson: { module: { course: { organizationId: user.organizationId ?? "__" } } } }) },
    }),
    db.pedagogicalMessage.count({
      where: { fromStaff: false, readAt: null, ...(user.role === "ADMIN" ? {} : { enrollment: { course: { organizationId: user.organizationId ?? "__" } } }) },
    }),
  ]);
  const [quality, openTasks] = await Promise.all([
    canManageQuality(user),
    user.organizationId ? db.task.count({ where: { organizationId: user.organizationId, assigneeId: user.id, status: "OPEN", dueAt: { lt: new Date() } } }) : Promise.resolve(0),
  ]);
  return (
    <div className="mx-auto flex max-w-[1500px] flex-col lg:flex-row">
      <aside className="no-print border-b border-slate-200 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="px-5 pb-2 pt-6">
          <div className="eyebrow">Espace OF</div>
          <div className="mt-1 truncate font-display text-[15px] font-semibold tracking-tight text-slate-900">
            {user.role === "ADMIN" ? "Tous les organismes" : org?.name ?? "—"}
          </div>
        </div>
        <nav className="flex gap-0.5 overflow-x-auto p-3 lg:flex-col">
          <SideLink href="/of/home" icon={<Home strokeWidth={1.75} />}>Tableau de bord</SideLink>
          {user.role !== "ADMIN" && <SideLink href="/of/tasks" icon={<CheckSquare strokeWidth={1.75} />} count={openTasks}>Tâches et relances</SideLink>}
          {manager && <SideLink href="/of/accounts" icon={<UserCheck strokeWidth={1.75} />} count={pendingAccounts}>Comptes apprenants</SideLink>}
          {manager && <SideLink href="/of/applications" icon={<Inbox strokeWidth={1.75} />} count={pendingApps}>Dossiers de candidature</SideLink>}
          {manager && <SideLink href="/of/access" icon={<KeyRound strokeWidth={1.75} />} count={pendingAccess}>Accès aux parcours</SideLink>}
          <SideLink href="/of/learners" icon={<Users strokeWidth={1.75} />}>Apprenants</SideLink>
          <SideLink href="/of/messages" icon={<MessagesSquare strokeWidth={1.75} />} count={unreadMessages}>Messagerie pédagogique</SideLink>
          {user.role === "OF_ADMIN" && <SideLink href="/of/support" icon={<Headset strokeWidth={1.75} />} count={openSupport}>Assistance</SideLink>}
          <div className="mx-3 my-2 hidden h-px bg-slate-200 lg:block" />
          <SideLink href="/of/courses" icon={<BookOpen strokeWidth={1.75} />}>Formations</SideLink>
          <SideLink href="/of/sessions" icon={<CalendarDays strokeWidth={1.75} />}>Sessions & émargement</SideLink>
          {manager && user.role !== "ADMIN" && <SideLink href="/of/companies" icon={<Building2 strokeWidth={1.75} />}>Entreprises clientes</SideLink>}
          <SideLink href="/of/grading" icon={<PenLine strokeWidth={1.75} />} count={pendingGrading}>Corrections</SideLink>
          <SideLink href="/of/rubrics" icon={<ClipboardList strokeWidth={1.75} />}>Grilles d&apos;évaluation</SideLink>
          {manager && <div className="mx-3 my-2 hidden h-px bg-slate-200 lg:block" />}
          {manager && <SideLink href="/of/reports" icon={<BarChart3 strokeWidth={1.75} />}>Rapports & traçabilité</SideLink>}
          {quality && <SideLink href="/of/qualiopi" icon={<BadgeCheck strokeWidth={1.75} />}>Qualiopi</SideLink>}
          {manager && <SideLink href="/of/quality" icon={<Star strokeWidth={1.75} />}>Qualité & réclamations</SideLink>}
          {user.role !== "ADMIN" && <SideLink href="/of/veille" icon={<Newspaper strokeWidth={1.75} />}>Veille</SideLink>}
          {user.role !== "ADMIN" && <SideLink href="/of/competences" icon={<GraduationCap strokeWidth={1.75} />}>Mes compétences</SideLink>}
          {manager && <SideLink href="/of/audit" icon={<ScrollText strokeWidth={1.75} />}>Journal d&apos;audit</SideLink>}
          {manager && <SideLink href="/of/team" icon={<UserCog strokeWidth={1.75} />}>Équipe</SideLink>}
          {manager && user.role !== "ADMIN" && <SideLink href="/of/settings" icon={<Settings strokeWidth={1.75} />}>Paramètres de l&apos;OF</SideLink>}
          {user.role === "OF_ADMIN" && <div className="mx-3 my-2 hidden h-px bg-slate-200 lg:block" />}
          {user.role === "OF_ADMIN" && <SideLink href="/of/tickets" icon={<LifeBuoy strokeWidth={1.75} />} count={ticketReplies}>Support Vylia</SideLink>}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
