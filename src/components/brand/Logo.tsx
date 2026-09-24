import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Monogramme Vylia : un point de départ, puis un parcours qui descend et remonte plus haut
 * qu'il n'est parti — la progression de l'apprenant, en forme de V et de coche de validation.
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" className={cn("h-8 w-8", className)} aria-hidden="true">
      <defs>
        <linearGradient id={`vg-${id}`} x1="10" y1="12" x2="54" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2997FF" />
          <stop offset=".55" stopColor="#7B61FF" />
          <stop offset="1" stopColor="#BF5AF2" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="15" r="5" fill={`url(#vg-${id})`} />
      <path d="M20.5 25 31 46.5 51 12" fill="none" stroke={`url(#vg-${id})`} strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, name = "Vylia" }: { className?: string; name?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="h-7 w-7" />
      <span className="font-display text-[17px] font-medium tracking-[-0.02em] text-slate-900">{name}</span>
    </span>
  );
}
