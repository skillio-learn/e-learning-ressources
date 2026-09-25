import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { headers } from "next/headers";
// Charte : Lora (titres) et Poppins (texte), auto-hébergées
import "@fontsource/lora/400.css";
import "@fontsource/lora/500.css";
import "@fontsource/lora/600.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/700.css";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import { timeoutsFor } from "@/lib/tracking";
import { Navbar } from "@/components/Navbar";
import { Logo } from "@/components/brand/Logo";
import { SupportWidget } from "@/components/support/SupportWidget";
import { ActivityTracker } from "@/components/tracking/ActivityTracker";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const base = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return {
    metadataBase: new URL(base),
    title: { default: s.platformName, template: `%s · ${s.platformName}` },
    description: s.tagline,
    applicationName: s.platformName,
    openGraph: { title: s.platformName, description: s.tagline, siteName: s.platformName, locale: "fr_FR", type: "website" },
    twitter: { card: "summary_large_image", title: s.platformName, description: s.tagline },
  };
}

export const viewport: Viewport = { themeColor: "#0e4d5c", colorScheme: "light" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const timeouts = user ? await timeoutsFor(user.id) : { standard: 15, interactive: 45 };
  // La page d'accueil tient sur un seul écran : elle porte ses propres mentions en pied de page
  const home = (await headers()).get("x-pathname") === "/";
  return (
    <html lang="fr" className="bg-canvas">
      <body className="flex min-h-screen flex-col">
        <Navbar />
        {user && <ActivityTracker timeoutMin={timeouts.standard} interactiveTimeoutMin={timeouts.interactive} />}
        <div className={user?.role === "LEARNER" && !home ? "flex-1 animate-fade-in pb-20" : "flex-1 animate-fade-in"}>{children}</div>
        {user?.role === "LEARNER" && <SupportWidget />}
        {!home && <footer className="no-print border-t border-slate-200 bg-surface">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-slate-500 sm:flex-row">
            <Logo className="h-6" />
            <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1">
              <Link href="/legal/mentions-legales" className="transition-colors hover:text-brand-600">Mentions légales</Link>
              <Link href="/legal/cgu" className="transition-colors hover:text-brand-600">CGU</Link>
              <Link href="/legal/confidentialite" className="transition-colors hover:text-brand-600">Confidentialité & RGPD</Link>
              <Link href="/legal/accessibilite" className="transition-colors hover:text-brand-600">Accessibilité & handicap</Link>
            </nav>
            <span>© {new Date().getFullYear()} {settings.platformName}</span>
          </div>
        </footer>}
      </body>
    </html>
  );
}
