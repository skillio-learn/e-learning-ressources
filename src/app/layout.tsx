import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import "@fontsource-variable/inter/opsz.css";
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

export const viewport: Viewport = { themeColor: "#fbfbfd", colorScheme: "light" };

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
        {!home && <footer className="no-print border-t border-black/[0.08]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row">
            <Logo name={settings.platformName} className="scale-90 opacity-70" />
            <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1">
              <Link href="/legal/mentions-legales" className="transition hover:text-slate-900">Mentions légales</Link>
              <Link href="/legal/cgu" className="transition hover:text-slate-900">CGU</Link>
              <Link href="/legal/confidentialite" className="transition hover:text-slate-900">Confidentialité & RGPD</Link>
              <Link href="/legal/accessibilite" className="transition hover:text-slate-900">Accessibilité & handicap</Link>
            </nav>
            <span>© {new Date().getFullYear()} {settings.platformName}</span>
          </div>
        </footer>}
      </body>
    </html>
  );
}
