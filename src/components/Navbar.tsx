import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_LABELS } from "@/lib/utils";
import { NavLink } from "./NavLink";

export async function Navbar() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const staff = user?.role === "ADMIN" || user?.role === "TRAINER";

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 font-bold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">S</span>
          <span className="hidden sm:inline">{settings.platformName}</span>
        </Link>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
          <NavLink href="/courses">Catalogue</NavLink>
          {user && <NavLink href="/dashboard">Tableau de bord</NavLink>}
          {user && <NavLink href="/learn">Mes formations</NavLink>}
          {staff && <NavLink href="/trainer/courses">Espace formateur</NavLink>}
          {staff && <NavLink href="/trainer/rubrics">Grilles</NavLink>}
          {staff && <NavLink href="/trainer/grading">Corrections</NavLink>}
          {user?.role === "ADMIN" && <NavLink href="/admin/users">Administration</NavLink>}
        </nav>
        {user ? (
          <div className="flex items-center gap-2">
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
