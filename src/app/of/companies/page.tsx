import Link from "next/link";
import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { createCompanyAction } from "@/app/actions/companies";
import { CompanyFields } from "@/components/of/CompanyFields";
import { StateForm } from "@/components/StateForm";
import { Badge, Container, Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Entreprises clientes" };
export const dynamic = "force-dynamic";

export default async function Companies() {
  const user = await requireOfManager();
  const companies = await db.company.findMany({
    where: { organizationId: user.organizationId ?? "__" },
    orderBy: { name: "asc" },
    include: { _count: { select: { enrollments: true, contacts: true, sessions: true } }, conventions: { where: { status: "SENT" }, select: { id: true } } },
  });
  return (
    <Container>
      <PageHeader title="Entreprises clientes" subtitle="Employeurs de vos stagiaires et commanditaires de sessions intra. Chaque entreprise dispose d'un espace pour suivre ses salariés, signer ses conventions et évaluer les formations." />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div>
          {companies.length === 0 ? <Empty title="Aucune entreprise">Créez la fiche de votre premier client.</Empty> : (
            <div className="card overflow-x-auto">
              <table className="table">
                <thead><tr><th>Entreprise</th><th>Salariés inscrits</th><th>Sessions intra</th><th>Contacts</th><th>Conventions</th></tr></thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id}>
                      <td><Link href={`/of/companies/${c.id}`} className="font-medium text-brand-600 hover:underline">{c.name}</Link><div className="text-xs text-slate-500">{[c.city, c.opcoName].filter(Boolean).join(" · ")}</div></td>
                      <td>{c._count.enrollments}</td>
                      <td>{c._count.sessions}</td>
                      <td>{c._count.contacts || <span className="text-slate-500">Aucun</span>}</td>
                      <td>{c.conventions.length ? <Badge tone="amber">{c.conventions.length} à signer</Badge> : "—"}{!c.active && <Badge>Inactive</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <aside className="card p-5">
          <h2 className="mb-3 text-xl">Nouvelle entreprise</h2>
          <StateForm action={createCompanyAction} submitLabel="Créer l'entreprise" submitClassName="btn-primary w-full" className="space-y-3">
            <CompanyFields />
          </StateForm>
        </aside>
      </div>
    </Container>
  );
}
