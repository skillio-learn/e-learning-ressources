import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import { inactivityTimeoutFor } from "@/lib/tracking";
import { Navbar } from "@/components/Navbar";
import { ActivityTracker } from "@/components/tracking/ActivityTracker";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: { default: s.platformName, template: `%s · ${s.platformName}` }, description: s.tagline };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const timeout = user ? await inactivityTimeoutFor(user.id) : 15;
  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col">
        <Navbar />
        {user && <ActivityTracker timeoutMin={timeout} />}
        <div className="flex-1">{children}</div>
        <footer className="no-print border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
          <Link href="/legal/mentions-legales" className="hover:underline">Mentions légales</Link> ·{" "}
          <Link href="/legal/cgu" className="hover:underline">CGU</Link> ·{" "}
          <Link href="/legal/confidentialite" className="hover:underline">Confidentialité & RGPD</Link> ·{" "}
          <Link href="/legal/accessibilite" className="hover:underline">Accessibilité & handicap</Link>
        </footer>
      </body>
    </html>
  );
}
