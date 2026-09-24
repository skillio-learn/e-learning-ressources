import { LogoMark } from "@/components/brand/Logo";

/** Cadre commun des écrans d'authentification : halo lumineux, monogramme, carte en verre. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="relative isolate flex min-h-[calc(100vh-8.5rem)] items-center justify-center overflow-hidden px-4 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12rem] h-[34rem] w-[34rem] -translate-x-1/2 animate-aurora rounded-full bg-[#2997ff]/20 blur-[120px]" />
        <div className="absolute bottom-[-14rem] left-1/2 h-[28rem] w-[28rem] translate-x-[10%] animate-aurora rounded-full bg-[#bf5af2]/15 blur-[120px] [animation-delay:-7s]" />
      </div>
      <div className="w-full max-w-[400px] animate-fade-up">
        <LogoMark className="mx-auto h-11 w-11" />
        <h1 className="mt-6 text-center font-display text-3xl font-semibold tracking-tightest">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-[15px] text-slate-500">{subtitle}</p>}
        <div className="card mt-8 p-7 shadow-glow">{children}</div>
      </div>
    </main>
  );
}
