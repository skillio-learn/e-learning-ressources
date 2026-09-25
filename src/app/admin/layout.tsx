import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Container } from "@/components/ui";
import { NavLink } from "@/components/NavLink";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN");
  const toHandle = await db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } });
  return (
    <Container>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 pb-2">
        <NavLink href="/admin/organizations">Organismes de formation</NavLink>
        <NavLink href="/admin/support">
          Support OF
          {toHandle > 0 && <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">{toHandle}</span>}
        </NavLink>
        <NavLink href="/admin/users">Utilisateurs & rôles</NavLink>
        <NavLink href="/admin/settings">Paramètres & pages légales</NavLink>
        <NavLink href="/admin/audit">Journal d&apos;audit</NavLink>
      </div>
      {children}
    </Container>
  );
}
