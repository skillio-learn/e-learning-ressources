"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Onglet de sous-navigation (soulignement Pétrole pour l'onglet actif). */
export function TabLink({ href, exact, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-brand-600",
      )}
    >
      {children}
    </Link>
  );
}
