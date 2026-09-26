import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { deleteQualificationAction, reviewQualificationAction } from "@/app/actions/quality";
import { QUALIF_KINDS, QualificationForm } from "@/components/quality/QualificationForm";
import { Badge, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Compétences des intervenants" };
export const dynamic = "force-dynamic";

const STATUS = { PENDING: { label: "À vérifier", tone: "red" }, VALIDATED: { label: "Vérifié", tone: "green" }, REJECTED: { label: "Refusé", tone: "gray" } } as const;

export default async function Trainers() {
  const user = await requireStaff();
  const orgId = user.organizationId!;
  const yearAgo = new Date(Date.now() - 365 * 86400_000);
  const people = await db.user.findMany({
    where: { organizationId: orgId, role: { in: ["TRAINER", "OF_ADMIN"] }, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, qualifications: { orderBy: { createdAt: "desc" } } },
  });
  return (
    <>
      <PageHeader title="Intervenants" subtitle="Indicateurs 21 et 22 : les compétences de chaque intervenant sont vérifiées (CV, diplômes) et entretenues (formations suivies). Les formateurs déposent eux-mêmes leurs justificatifs depuis « Mes compétences » ; vous les vérifiez ici." />
      <div className="space-y-4">
        {people.map((p) => {
          const verified = p.qualifications.filter((q) => q.status === "VALIDATED" && q.kind !== "TRAINING").length;
          const trained = p.qualifications.some((q) => q.status === "VALIDATED" && q.kind === "TRAINING" && (q.obtainedAt ?? q.createdAt) >= yearAgo);
          return (
            <details key={p.id} className="card p-5">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-900">{p.name}</span>
                  <span className="text-sm text-slate-500">{p.role === "OF_ADMIN" ? "Responsable" : "Formateur"} · {p.email}</span>
                </span>
                <Badge tone={verified ? "green" : "red"}>{verified ? `${verified} justificatif(s) vérifié(s)` : "Compétences non justifiées"}</Badge>
                <Badge tone={trained ? "green" : "gray"}>{trained ? "Formé dans l'année" : "Pas de formation dans l'année"}</Badge>
              </summary>
              <ul className="mt-4 divide-y divide-slate-100">
                {p.qualifications.map((q) => {
                  const st = STATUS[q.status as keyof typeof STATUS];
                  const expired = q.expiresAt && q.expiresAt < new Date();
                  return (
                    <li key={q.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-slate-900">{QUALIF_KINDS[q.kind] ?? q.kind} · {q.title}</span>
                        <span className="block text-slate-500">
                          {[q.issuer, q.obtainedAt && `obtenu le ${formatDate(q.obtainedAt)}`, q.expiresAt && `expire le ${formatDate(q.expiresAt)}`].filter(Boolean).join(" · ")}
                          {q.fileName && <> · <a href={`/api/quality/qualifications/${q.id}`} className="link">{q.fileName}</a></>}
                        </span>
                      </span>
                      {expired && <Badge tone="red">Expiré</Badge>}
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {q.status === "PENDING" && (
                        <>
                          <form action={reviewQualificationAction.bind(null, q.id, "VALIDATED")}><button className="btn-secondary btn-sm">Valider</button></form>
                          <form action={reviewQualificationAction.bind(null, q.id, "REJECTED")}><button className="btn-ghost btn-sm">Refuser</button></form>
                        </>
                      )}
                      <form action={deleteQualificationAction.bind(null, q.id)}><button className="btn-ghost btn-sm text-red-600">Supprimer</button></form>
                    </li>
                  );
                })}
                {!p.qualifications.length && <li className="py-2 text-sm text-slate-500">Aucun justificatif.</li>}
              </ul>
              <details className="mt-3 rounded-[10px] border border-slate-200 p-4">
                <summary className="cursor-pointer font-medium text-brand-600">Ajouter un justificatif pour {p.name}</summary>
                <div className="mt-3"><QualificationForm userId={p.id} /></div>
              </details>
            </details>
          );
        })}
      </div>
    </>
  );
}
