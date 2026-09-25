import Link from "next/link";
import { headers } from "next/headers";
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
  const path = (await headers()).get("x-pathname") ?? "";
  // Accueil et pages d'authentification portent déjà leur bouton principal « Se connecter »
  const authPage = path === "/" || ["/login", "/forgot-password", "/reset-password"].some((p) => path.startsWith(p));
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
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-surface">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-8">
        <Link href={user ? (user.role === "ADMIN" ? "/admin" : staff ? "/of" : "/dashboard") : "/"} className="shrink-0 rounded-[10px]" aria-label={`${settings.platformName} : accueil`}>
          {/* Logo horizontal : 120 px de large minimum (charte) */}
          <Logo className="h-[38px]" />
        </Link>
        <nav className="-mx-1 flex flex-1 items-center gap-0.5 overflow-x-auto px-1 [scrollbar-width:none]">
          {user && !staff && <NavLink href="/dashboard">Tableau de bord</NavLink>}
          {user && !staff && <NavLink href="/learn">Mes formations</NavLink>}
          {user && !staff && <NavLink href="/applications">Mes dossiers</NavLink>}
          {user && !staff && <NavLink href="/attendance">Émargement</NavLink>}
          {user && !staff && <NavLink href="/support">Aide</NavLink>}
          {staff && user?.role !== "ADMIN" && <NavLink href="/of">Espace OF{org ? ` · ${org.name}` : ""}</NavLink>}
          {user?.role === "ADMIN" && <NavLink href="/admin">Administration</NavLink>}
        </nav>
        {user ? (
          <div className="flex items-center gap-1.5">
            <Link
              href="/notifications"
              className="relative grid h-10 w-10 place-items-center rounded-[10px] text-brand-600 transition-colors hover:bg-brand-50"
              title="Notifications"
              aria-label={unread > 0 ? `Notifications : ${unread} non lue(s)` : "Notifications"}
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {unread > 0 && (
                <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-medium text-white ring-2 ring-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <Link href="/profile" className="flex items-center gap-2.5 rounded-[10px] py-1 pl-1 pr-1 transition-colors hover:bg-brand-50 md:pr-3" title="Mon profil">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-xs font-medium text-white">
                {initials}
              </span>
              <span className="hidden text-left leading-tight md:block">
                <span className="block text-sm font-medium text-slate-900">{user.name}</span>
                <span className="block text-xs text-slate-500">{ROLE_LABELS[user.role]}</span>
              </span>
            </Link>
            <form action={logoutAction}>
              <button
                className="grid h-10 w-10 place-items-center rounded-[10px] text-brand-600 transition-colors hover:bg-brand-50"
                title="Se déconnecter"
                aria-label="Déconnexion"
              >
                <LogOut className="h-[17px] w-[17px]" strokeWidth={1.75} />
              </button>
            </form>
          </div>
        ) : (
          !authPage && (
            <div className="flex items-center gap-1.5">
              <Link href="/login" className="btn-secondary">Se connecter</Link>
            </div>
          )
        )}
      </div>
    </header>
  );
}
