import Link from "next/link";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_LABELS } from "@/lib/utils";
import { NavLink } from "./NavLink";

export async function Navbar() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const staff = isStaff(user);
  const [unread, org] = user
    ? await Promise.all([
        db.notification.count({ where: { userId: user.id, readAt: null } }),
        user.organizationId ? db.organization.findUnique({ where: { id: user.organizationId }, select: { name: true } }) : null,
      ])
    : [0, null];

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href={user ? (staff ? "/of" : "/dashboard") : "/"} className="flex items-center gap-2 font-bold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">S</span>
          <span className="hidden sm:inline">{settings.platformName}</span>
        </Link>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
          {!staff && <NavLink href="/courses">Catalogue</NavLink>}
          {user && !staff && <NavLink href="/dashboard">Tableau de bord</NavLink>}
          {user && !staff && <NavLink href="/learn">Mes formations</NavLink>}
          {user && !staff && <NavLink href="/applications">Mes dossiers</NavLink>}
          {user && !staff && <NavLink href="/attendance">Émargement</NavLink>}
          {user && !staff && <NavLink href="/support">Aide & réclamations</NavLink>}
          {staff && <NavLink href="/of">Espace OF{org ? ` · ${org.name}` : ""}</NavLink>}
          {staff && <NavLink href="/courses">Catalogue</NavLink>}
          {user?.role === "ADMIN" && <NavLink href="/admin">Administration Skillio</NavLink>}
        </nav>
        {user ? (
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="relative rounded-md p-2 hover:bg-slate-100" title="Notifications">
              🔔
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <Link href="/profile" className="hidden text-right text-xs leading-tight md:block">
              <div className="font-medium text-slate-800">{user.name}</div>
              <div className="text-slate-500">{ROLE_LABELS[user.role]}</div>
            </Link>
            <form action={logoutAction}>
              <button className="btn-ghost btn-sm" title="Se déconnecter">Déconnexion</button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost btn-sm">Connexion</Link>
            {settings.allowRegistration === "true" && (
              <Link href="/register" className="btn-primary btn-sm">Créer un compte</Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
