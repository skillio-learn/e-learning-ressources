import Link from "next/link";
import { ChevronLeft, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 animate-fade-up">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-0.5 text-sm text-slate-500 transition-colors hover:text-brand-600">
          <ChevronLeft className="h-4 w-4" strokeWidth={2} /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="mt-2 max-w-[75ch] text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cn("mx-auto max-w-7xl px-4 py-10", className)}>{children}</main>;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">{label}</div>
      {/* Chiffres clés en Lora (charte) */}
      <div className="mt-1 font-title text-[32px] leading-10 text-brand-600">{value}</div>
      {hint && <div className="mt-1 text-sm text-slate-500">{hint}</div>}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    // Charte : 6 px de haut, piste Pétrole 50, remplissage Pétrole
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-brand-50", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full rounded-full bg-brand-600 transition-[width] duration-700 ease-out"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/** Badges de la charte : texte + couleur (+ point), lisibles sans voir les couleurs. */
const tones = {
  gray: { cls: "bg-slate-100 text-slate-700", dot: "bg-slate-500" }, // En cours
  blue: { cls: "bg-brand-50 text-brand-600", dot: null }, // Nouveau
  green: { cls: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-600" }, // Validé
  amber: { cls: "bg-brand-50 text-brand-700", dot: "bg-brand-600" }, // À traiter, en attente
  gold: { cls: "bg-ambre-100 text-slate-900", dot: "bg-ambre-400" }, // Réussite : terminé, certifié
  red: { cls: "bg-red-50 text-red-600", dot: "bg-red-600" }, // À rattraper
  purple: { cls: "bg-brand-50 text-brand-700", dot: null },
};

export function Badge({ tone = "gray", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  const t = tones[tone];
  return (
    <span className={cn("badge", t.cls)}>
      {t.dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-12 text-center">
      <div className="mb-1 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Inbox className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="font-medium text-slate-900">{title}</div>
      {children && <div className="text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}
