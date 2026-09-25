import type { Config } from "tailwindcss";

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
/** Palettes pilotées par les variables CSS de la charte Vylia (src/app/globals.css). */
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
        ambre: themed("ambre"),
        violet: themed("violet"),
        blue: themed("blue"),
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
      },
      // Charte : Poppins pour le texte et l'interface, Lora pour les titres et les chiffres clés
      fontFamily: {
        sans: ["Poppins", "Arial", "sans-serif"],
        display: ["Lora", "Georgia", "serif"],
      },
      letterSpacing: { tightest: "-0.01em" },
      // Poppins est chargée en 400 / 500 / 700 : « semibold » se rend en Medium (les titres Lora ont leur propre graisse)
      fontWeight: { medium: "500", semibold: "500", bold: "700", extrabold: "700" },
      // Rayons de la charte : 8 px petits éléments, 10 px boutons et champs, 16 px cartes et fenêtres
      borderRadius: { s: "8px", m: "10px", l: "16px", xl: "10px", "2xl": "16px", "3xl": "16px" },
      boxShadow: {
        // Aucune ombre sur les cartes ; ombre réservée aux éléments flottants (menus, fenêtres, info-bulles)
        glow: "0 8px 24px rgba(23, 38, 45, 0.08)",
        card: "none",
        float: "0 8px 24px rgba(23, 38, 45, 0.08)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(14px)" }, "100%": { opacity: "1", transform: "none" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
      },
      animation: {
        "fade-up": "fade-up .7s cubic-bezier(.16,1,.3,1) both",
        "fade-in": "fade-in .6s ease both",
      },
    },
  },
  plugins: [],
} satisfies Config;
