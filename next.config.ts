import type { NextConfig } from "next";

// Politique de sécurité du contenu. Les scripts en ligne restent autorisés (flux RSC de Next.js) ;
// les modules interactifs et vidéos intégrés (https) peuvent être encadrés, la plateforme ne peut pas l'être.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  "connect-src 'self'",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Limite Vercel : 4,5 Mo par requête (fichiers de 4 Mo maximum, voir src/lib/uploads.ts)
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  async headers() {
    return [
      // Les routes /api définissent leurs propres en-têtes (fichiers, modules interactifs en bac à sable)
      { source: "/((?!api/).*)", headers: securityHeaders },
      { source: "/api/:path*", headers: securityHeaders.filter((h) => h.key !== "Content-Security-Policy" && h.key !== "X-Frame-Options") },
    ];
  },
};

export default nextConfig;
