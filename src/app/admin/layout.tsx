import { requireRole } from "@/lib/auth";
import { Container } from "@/components/ui";
import { NavLink } from "@/components/NavLink";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN");
  return (
    <Container>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 pb-2">
        <NavLink href="/admin/organizations">🏢 Organismes de formation</NavLink>
        <NavLink href="/admin/users">👥 Utilisateurs & rôles</NavLink>
        <NavLink href="/admin/settings">⚙️ Paramètres & pages légales</NavLink>
        <NavLink href="/of/audit">🔍 Journal d&apos;audit global</NavLink>
      </div>
      {children}
    </Container>
  );
}
