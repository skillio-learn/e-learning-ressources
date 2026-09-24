"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="text-5xl">⚠️</div>
      <h1 className="mt-4">Une erreur est survenue</h1>
      <p className="mt-2 text-slate-500">{error.message || "Veuillez réessayer."}</p>
      <button onClick={reset} className="btn-primary mt-6">Réessayer</button>
    </main>
  );
}
