import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { canManageQuality } from "@/lib/qualiopi-evidence";
import { Container } from "@/components/ui";
import { TabLink } from "@/components/of/TabLink";

const TABS = [
  ["/of/qualiopi", "Tableau de bord"],
  ["/of/qualiopi/indicateurs", "Indicateurs"],
  ["/of/qualiopi/amelioration", "Amélioration et risques"],
  ["/of/qualiopi/audits", "Audits"],
  ["/of/qualiopi/veille", "Veille"],
  ["/of/qualiopi/handicap", "Handicap"],
  ["/of/qualiopi/formateurs", "Intervenants"],
  ["/of/qualiopi/sous-traitants", "Sous-traitants"],
  ["/of/qualiopi/resultats", "Résultats publiés"],
  ["/of/qualiopi/dossier", "Dossier d'audit"],
  ["/of/qualiopi/parametres", "Paramètres"],
] as const;

/** Module Qualiopi : réservé au responsable de l'organisme et au référent qualité désigné. */
export default async function QualiopiLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  if (!(await canManageQuality(user))) notFound();
  return (
    <Container className="max-w-6xl">
      <nav className="no-print -mx-1 mb-8 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 pb-px [scrollbar-width:none]" aria-label="Qualiopi">
        {TABS.map(([href, label]) => <TabLink key={href} href={href} exact={href === "/of/qualiopi"}>{label}</TabLink>)}
      </nav>
      {children}
    </Container>
  );
}
