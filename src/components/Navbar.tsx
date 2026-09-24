import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_LABELS } from "@/lib/utils";
import { NavLink } from "./NavLink";
import { Logo } from "./brand/Logo";

export async function Navbar() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const staff = isStaff(user);
  const [unread, org] = user
    ? await Promise.all([
        db.notification.count({ where: { userId: user.id, readAt: null } }),
        user.organizationId ? db.organization.findUnique({ where: { id: user.organizationId }, select: { name: true } }) : null,
      ])
    : [0, null];
  const initials = user?.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <header className="no-print glass sticky top-0 z-40 border-b border-white/[0.08]">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-6">
        <Link href={user ? (staff ? "/of" : "/dashboard") : "/"} className="shrink-0 transition-opacity hover:opacity-80" aria-label={settings.platformName}>
          <Logo name={settings.platformName} />
        </Link>
        <nav className="-mx-1 flex flex-1 items-center gap-0.5 overflow-x-auto px-1 [scrollbar-width:none]">
          {!staff && <NavLink href="/courses">Catalogue</NavLink>}
          {user && !staff && <NavLink href="/dashboard">Tableau de bord</NavLink>}
          {user && !staff && <NavLink href="/learn">Mes formations</NavLink>}
          {user && !staff && <NavLink href="/applications">Mes dossiers</NavLink>}
          {user && !staff && <NavLink href="/attendance">Émargement</NavLink>}
          {user && !staff && <NavLink href="/support">Aide</NavLink>}
          {staff && <NavLink href="/of">Espace OF{org ? ` · ${org.name}` : ""}</NavLink>}
          {staff && <NavLink href="/courses">Catalogue</NavLink>}
          {user?.role === "ADMIN" && <NavLink href="/admin">Administration</NavLink>}
        </nav>
        {user ? (
          <div className="flex items-center gap-1.5">
            <Link
              href="/notifications"
              className="relative grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              title="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {unread > 0 && (
                <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[9px] font-semibold text-white ring-2 ring-black">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <Link href="/profile" className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition hover:bg-slate-100 md:pr-3" title="Mon profil">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#2997ff] to-[#bf5af2] text-[11px] font-semibold text-white">
                {initials}
              </span>
              <span className="hidden text-left leading-tight md:block">
                <span className="block text-[13px] font-medium text-slate-900">{user.name}</span>
                <span className="block text-[11px] text-slate-500">{ROLE_LABELS[user.role]}</span>
              </span>
            </Link>
            <form action={logoutAction}>
              <button
                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                title="Se déconnecter"
                aria-label="Déconnexion"
              >
                <LogOut className="h-[17px] w-[17px]" strokeWidth={1.75} />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
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
