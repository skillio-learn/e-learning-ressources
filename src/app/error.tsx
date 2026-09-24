"use client";
import { TriangleAlert } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-amber-100 text-amber-500 ring-1 ring-amber-200"><TriangleAlert className="h-7 w-7" strokeWidth={1.75} /></div>
      <h1 className="mt-4">Une erreur est survenue</h1>
      <p className="mt-2 text-slate-500">{error.message || "Veuillez réessayer."}</p>
      <button onClick={reset} className="btn-primary mt-6">Réessayer</button>
    </main>
  );
}
