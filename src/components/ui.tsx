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
        <Link href={back.href} className="mb-3 inline-flex items-center gap-0.5 text-[13px] text-slate-500 transition hover:text-slate-900">
          <ChevronLeft className="h-4 w-4" strokeWidth={2} /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tightest md:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] text-slate-500">{subtitle}</p>}
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
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-200", className)}>
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,#2997ff,#7b61ff,#bf5af2)] transition-[width] duration-700 ease-out"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

const tones = {
  gray: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
  blue: "bg-brand-100 text-brand-700 ring-1 ring-inset ring-brand-200",
  green: "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  amber: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200",
  red: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200",
  purple: "bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200",
};

export function Badge({ tone = "gray", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  return <span className={cn("badge", tones[tone])}>{children}</span>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-12 text-center">
      <div className="mb-1 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-200">
        <Inbox className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="font-semibold text-slate-800">{title}</div>
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
