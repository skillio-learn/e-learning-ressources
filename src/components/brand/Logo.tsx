import { cn } from "@/lib/utils";

/**
 * Logo officiel Vylia (charte graphique v1.0) : un V qui valide, dont le point Ambre fait
 * une silhouette qui lève les bras, et le logotype « vylia » dessiné d'après Poppins Medium.
 * Tracés repris à l'identique des fichiers SVG de la charte : ne pas les modifier.
 */

const PETROLE = "#0E4D5C";
const AMBRE = "#F2B33D";
const ARDOISE = "#17262D";
const BLANC = "#FFFFFF";

/** Logotype « vylia » (sans le point du i, dessiné à part en Ambre). */
const WORDMARK =
  "M288 102 444 551H565L355 0H219L10 551H132Z M1161 551 823 -259H705L817 9L600 551H727L882 131L1043 551Z M1375 740V0H1261V740Z M1653 551V0H1539V551Z M2039 560Q2104 560 2152.5 534.5Q2201 509 2230 471V551H2345V0H2230V82Q2201 43 2151.0 17.0Q2101 -9 2037 -9Q1966 -9 1907.0 27.5Q1848 64 1813.5 129.5Q1779 195 1779 278Q1779 361 1813.5 425.0Q1848 489 1907.5 524.5Q1967 560 2039 560ZM2063 461Q2019 461 1981.0 439.5Q1943 418 1919.5 376.5Q1896 335 1896 278Q1896 221 1919.5 178.0Q1943 135 1981.5 112.5Q2020 90 2063 90Q2107 90 2145.0 112.0Q2183 134 2206.5 176.5Q2230 219 2230 276Q2230 333 2206.5 375.0Q2183 417 2145.0 439.0Q2107 461 2063 461Z";

export type LogoVariant = "principal" | "inverse" | "mono-sombre" | "mono-clair";

const COLORS: Record<LogoVariant, { ink: string; dot: string }> = {
  principal: { ink: PETROLE, dot: AMBRE }, // fond Blanc ou Brume (version prioritaire)
  inverse: { ink: BLANC, dot: AMBRE }, // fond Pétrole ou photo sombre
  "mono-sombre": { ink: ARDOISE, dot: ARDOISE }, // impression noir et blanc
  "mono-clair": { ink: BLANC, dot: BLANC }, // fonds sombres sans Ambre possible
};

/** Symbole seul : quand la marque est déjà identifiée (24 px minimum à l'écran). */
export function LogoMark({ className, variant = "principal", title }: { className?: string; variant?: LogoVariant; title?: string }) {
  const c = COLORS[variant];
  return (
    <svg viewBox="0 0 100 100" className={cn("h-8 w-8", className)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d="M17.00 43.00 L41.00 82.00 L83.00 19.00" fill="none" stroke={c.ink} strokeWidth="13.50" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="47.00" cy="30.00" r="9.50" fill={c.dot} />
    </svg>
  );
}

/** Logo horizontal (symbole + logotype) : 120 px de large minimum à l'écran. */
export function Logo({ className, variant = "principal" }: { className?: string; variant?: LogoVariant }) {
  const c = COLORS[variant];
  return (
    <svg viewBox="-20 -780 3442 1080" className={cn("h-9 w-auto", className)} role="img" aria-label="Vylia">
      <path d="M72.80 -427.80 L322.40 -22.20 L759.20 -677.40" fill="none" stroke={c.ink} strokeWidth="140.40" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="384.80" cy="-563.00" r="98.80" fill={c.dot} />
      <g transform="translate(982.0,0) scale(1,-1)">
        <path d={WORDMARK} fill={c.ink} />
        <circle cx="1596.5" cy="697.0" r="78.3" fill={c.dot} />
      </g>
    </svg>
  );
}

/** Version empilée : formats carrés (80 px de large minimum). */
export function LogoStacked({ className, variant = "principal" }: { className?: string; variant?: LogoVariant }) {
  const c = COLORS[variant];
  return (
    <svg viewBox="-40 96 2500 2067" className={cn("h-20 w-auto", className)} role="img" aria-label="Vylia">
      <path d="M863.50 451.50 L1115.50 861.00 L1556.50 199.50" fill="none" stroke={c.ink} strokeWidth="141.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="1178.50" cy="315.00" r="99.75" fill={c.dot} />
      <g transform="translate(0.0,1864.5) scale(1,-1)">
        <path d={WORDMARK} fill={c.ink} />
        <circle cx="1596.5" cy="697.0" r="78.3" fill={c.dot} />
      </g>
    </svg>
  );
}
