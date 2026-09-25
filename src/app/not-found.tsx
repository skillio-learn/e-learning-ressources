import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="font-title text-8xl text-brand-600">404</div>
      <h1 className="mt-4">Page introuvable</h1>
      <p className="mt-2 text-slate-500">Cette page n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
      <Link href="/dashboard" className="btn-primary mt-6">Retour au tableau de bord</Link>
    </main>
  );
}
