"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function CourseTabs({ courseId }: { courseId: string }) {
  const path = usePathname();
  const base = `/of/courses/${courseId}`;
  const tabs = [
    { href: base, label: "Parcours", match: (p: string) => p === base || p.startsWith(`${base}/lessons`) },
    { href: `${base}/settings`, label: "Paramètres" },
    { href: `${base}/learners`, label: "Apprenants" },
    { href: `${base}/results`, label: "Résultats & grilles" },
  ];
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => {
        const active = t.match ? t.match(path) : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium",
              active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
