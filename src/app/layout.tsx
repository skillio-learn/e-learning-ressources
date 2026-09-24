import type { Metadata } from "next";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { Navbar } from "@/components/Navbar";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: { default: s.platformName, template: `%s · ${s.platformName}` }, description: s.tagline };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
