import type { Config } from "tailwindcss";

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
/** Palettes pilotées par variables CSS : thème sombre par défaut, thème « papier » pour les documents imprimables. */
const themed = (name: string) =>
  Object.fromEntries(STEPS.map((s) => [s, `rgb(var(--c-${name}-${s}) / <alpha-value>)`]));

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: themed("slate"),
        brand: themed("brand"),
        red: themed("red"),
        emerald: themed("emerald"),
        amber: themed("amber"),
        violet: themed("violet"),
        blue: themed("blue"),
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
      },
      fontFamily: {
        sans: ['"Inter Variable"', "-apple-system", "BlinkMacSystemFont", '"SF Pro Text"', '"Segoe UI"', "Roboto", "sans-serif"],
        display: ['"Inter Variable"', "-apple-system", "BlinkMacSystemFont", '"SF Pro Display"', '"Segoe UI"', "sans-serif"],
      },
      letterSpacing: { tightest: "-0.035em" },
      // Graisses allégées : l'esprit SF Pro (titres fins, texte aéré).
      fontWeight: { medium: "480", semibold: "560", bold: "620", extrabold: "660" },
      boxShadow: {
        glow: "0 1px 2px rgb(0 0 0 / 0.04), 0 22px 48px -18px rgb(0 0 0 / 0.18)",
        card: "0 1px 2px rgb(0 0 0 / 0.03), 0 6px 24px -12px rgb(0 0 0 / 0.08)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(14px)" }, "100%": { opacity: "1", transform: "none" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        shimmer: { "0%": { backgroundPosition: "0% 50%" }, "100%": { backgroundPosition: "200% 50%" } },
        // Propriétés individuelles (translate/scale) : se combinent avec les utilitaires -translate-x-* sans les écraser.
        float: { "0%,100%": { translate: "0 0" }, "50%": { translate: "0 -10px" } },
        aurora: {
          "0%,100%": { translate: "0 0", scale: "1" },
          "50%": { translate: "4% -3%", scale: "1.08" },
        },
      },
      animation: {
        "fade-up": "fade-up .7s cubic-bezier(.16,1,.3,1) both",
        "fade-in": "fade-in .6s ease both",
        shimmer: "shimmer 6s linear infinite",
        float: "float 6s ease-in-out infinite",
        aurora: "aurora 18s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
