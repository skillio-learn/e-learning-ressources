/** Cadre commun des écrans d'authentification : fond Brume, carte Blanche bordée. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="flex min-h-[calc(100vh-8.5rem)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-[420px] animate-fade-in">
        <h1 className="text-center">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-slate-500">{subtitle}</p>}
        <div className="card mt-8 p-8">{children}</div>
      </div>
    </main>
  );
}
