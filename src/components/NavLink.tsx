"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
        active ? "bg-brand-50 text-brand-600" : "text-slate-600 hover:bg-slate-50 hover:text-brand-600",
      )}
    >
      {children}
    </Link>
  );
}

/** Lien de barre latérale (espace OF, administration). */
export function SideLink({ href, icon, children, count }: { href: string; icon?: React.ReactNode; children: React.ReactNode; count?: number }) {
  const path = usePathname();
  const active = path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
        active ? "bg-brand-50 text-brand-600" : "text-slate-600 hover:bg-slate-50 hover:text-brand-600",
      )}
    >
      {icon && (
        <span className={cn("grid h-4 w-4 place-items-center transition-colors [&_svg]:h-4 [&_svg]:w-4", active ? "text-brand-600" : "text-slate-500 group-hover:text-brand-600")}>
          {icon}
        </span>
      )}
      <span className="flex-1">{children}</span>
      {count ? <span className="rounded-full bg-brand-600 px-1.5 py-px text-[11px] font-medium text-white">{count}</span> : null}
    </Link>
  );
}
