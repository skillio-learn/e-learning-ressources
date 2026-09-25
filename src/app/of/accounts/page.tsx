import Link from "next/link";
import type { AccountStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import { createLearnerAccountAction } from "@/app/actions/accounts";
import { StateForm } from "@/components/StateForm";
import { Badge, Container, Empty, PageHeader } from "@/components/ui";
import { ACCOUNT_STATUS } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Comptes apprenants" };
export const dynamic = "force-dynamic";

const TABS: { key: AccountStatus; label: string }[] = [
  { key: "PENDING_REVIEW", label: "À valider" },
  { key: "PENDING_PROFILE", label: "En cours de saisie" },
  { key: "ACTIVE", label: "Validés" },
  { key: "REJECTED", label: "Refusés" },
];

export default async function OfAccounts({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requireOfManager();
  const { status: s, q } = await searchParams;
  const status = (TABS.some((t) => t.key === s) ? s : "PENDING_REVIEW") as AccountStatus;
  const scope: Prisma.UserWhereInput = { role: "LEARNER", ...(user.role === "ADMIN" ? {} : { organizationId: user.organizationId ?? "__none__" }) };
  const [counts, accounts, orgs, changeRequests, courses] = await Promise.all([
    db.user.groupBy({ by: ["accountStatus"], where: scope, _count: true }),
    db.user.findMany({
      where: {
        ...scope,
        accountStatus: status,
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: status === "PENDING_REVIEW" ? { accountSubmittedAt: "asc" } : { createdAt: "desc" },
      take: 300,
      select: {
        id: true, name: true, email: true, createdAt: true, createdVia: true, accountSubmittedAt: true, accountReviewedAt: true,
        organization: { select: { name: true } },
        _count: { select: { learnerDocuments: { where: { enrollmentId: null, status: "PENDING" } } } },
      },
    }),
    user.role === "ADMIN" ? db.organization.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    db.profileChangeRequest.findMany({
      where: { status: "PENDING", user: scope },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, changes: true, user: { select: { id: true, name: true } } },
    }),
    db.course.findMany({
      where: { status: "PUBLISHED", ...(user.role === "ADMIN" ? {} : { organizationId: user.organizationId ?? "__none__" }) },
      orderBy: { title: "asc" },
      select: { id: true, title: true, sessions: { where: { open: true }, orderBy: { startDate: "asc" }, select: { id: true, name: true } } },
    }),
  ]);
  const count = (k: AccountStatus) => counts.find((c) => c.accountStatus === k)?._count ?? 0;

  return (
    <Container>
      <PageHeader
        title="Comptes apprenants"
        subtitle="Validation des inscriptions à la plateforme : informations administratives et pièces justificatives."
      />
      <details className="card mb-6 p-5">
        <summary className="cursor-pointer font-medium text-slate-900">Créer un compte apprenant</summary>
        <p className="mt-2 text-sm text-slate-500">
          L&apos;apprenant reçoit un email d&apos;activation pour choisir son mot de passe, complète son dossier administratif et ses documents d&apos;inscription, puis vous validez.
        </p>
        <StateForm action={createLearnerAccountAction} submitLabel="Créer le compte" submitClassName="btn-primary" className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm"><span className="label">Civilité</span>
            <select name="civility" className="input"><option value="">—</option><option>M.</option><option>Mme</option></select>
          </label>
          <label className="text-sm"><span className="label">Prénom *</span><input name="firstName" required className="input" /></label>
          <label className="text-sm"><span className="label">Nom *</span><input name="lastName" required className="input" /></label>
          <label className="text-sm"><span className="label">Email *</span><input name="email" type="email" required className="input" /></label>
          <label className="text-sm"><span className="label">Téléphone</span><input name="phone" className="input" /></label>
          {courses.length > 0 && (
            <fieldset className="md:col-span-3">
              <legend className="label">Inscrire directement à une ou plusieurs formations (facultatif)</legend>
              <p className="mb-2 text-xs text-slate-500">L&apos;apprenant fournira ses documents d&apos;inscription en même temps que son dossier de compte : un seul email, un seul passage.</p>
              <div className="grid gap-2 md:grid-cols-2">
                {courses.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3">
                    <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                      <input type="checkbox" name="courseIds" value={c.id} />
                      <span className="truncate">{c.title}</span>
                    </label>
                    {c.sessions.length > 0 && (
                      <select name={`session_${c.id}`} className="input w-auto py-1 text-xs" defaultValue="">
                        <option value="">Sans session</option>
                        {c.sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
          )}
          {user.role === "ADMIN" && (
            <label className="text-sm"><span className="label">Organisme *</span>
              <select name="organizationId" required className="input">
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
          )}
        </StateForm>
      </details>

      {changeRequests.length > 0 && (
        <section className="card mb-6 p-5 ring-2 ring-amber-200">
          <h2 className="mb-3 text-base">Demandes de modification d&apos;informations ({changeRequests.length})</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {changeRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><b className="font-medium text-slate-900">{r.user.name}</b> · {Object.keys(r.changes as object).length} information(s) · {formatDate(r.createdAt, true)}</span>
                <Link href={`/of/accounts/${r.user.id}`} className="btn-secondary btn-sm">Examiner</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/of/accounts?status=${t.key}`}
            className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium transition", status === t.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
          >
            {t.label} <span className="ml-1 tabular-nums opacity-70">{count(t.key)}</span>
          </Link>
        ))}
        <form className="ml-auto flex gap-2">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Nom ou email" className="input w-56 py-1.5" />
        </form>
      </div>

      {accounts.length === 0 ? (
        <Empty title="Aucun compte dans cette catégorie" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Apprenant</th>
                {user.role === "ADMIN" && <th>Organisme</th>}
                <th>Origine</th>
                <th>Créé le</th>
                <th>{status === "PENDING_REVIEW" ? "Envoyé le" : "Dernière décision"}</th>
                <th>Pièces à vérifier</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="font-medium text-slate-900">{a.name}</div>
                    <div className="text-xs text-slate-500">{a.email}</div>
                  </td>
                  {user.role === "ADMIN" && <td>{a.organization?.name ?? <span className="text-slate-500">Aucun</span>}</td>}
                  <td>{a.createdVia === "OF" ? "Créé par l'OF" : a.createdVia === "ADMIN" ? "Créé par Vylia" : "Auto-inscription"}</td>
                  <td>{formatDate(a.createdAt)}</td>
                  <td>{formatDate(status === "PENDING_REVIEW" ? a.accountSubmittedAt : a.accountReviewedAt, true)}</td>
                  <td>{a._count.learnerDocuments ? <Badge tone="blue">{a._count.learnerDocuments}</Badge> : "—"}</td>
                  <td className="text-right">
                    <Link href={`/of/accounts/${a.id}`} className="btn-secondary btn-sm">{status === "PENDING_REVIEW" ? "Examiner" : "Ouvrir"}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">Statuts : {Object.values(ACCOUNT_STATUS).map((v) => v.label).join(" · ")}</p>
    </Container>
  );
}
