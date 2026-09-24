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
        "relative whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium tracking-[-0.01em] transition-colors duration-200",
        active ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900",
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
        "group flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-200",
        active ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-100/60 hover:text-slate-900",
      )}
    >
      {icon && (
        <span className={cn("grid h-4 w-4 place-items-center transition-colors [&_svg]:h-4 [&_svg]:w-4", active ? "text-brand-500" : "text-slate-400 group-hover:text-slate-700")}>
          {icon}
        </span>
      )}
      <span className="flex-1">{children}</span>
      {count ? <span className="rounded-full bg-brand-600 px-1.5 py-px text-[10px] font-semibold text-white">{count}</span> : null}
    </Link>
  );
}
