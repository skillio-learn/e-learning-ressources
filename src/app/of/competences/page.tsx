import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { deleteQualificationAction } from "@/app/actions/quality";
import { QUALIF_KINDS, QualificationForm } from "@/components/quality/QualificationForm";
import { Badge, Container, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Mes compétences" };
export const dynamic = "force-dynamic";

/** Le formateur tient à jour ses justificatifs (CV, diplômes, formations suivies), vérifiés par le référent qualité. */
export default async function MyQualifications() {
  const user = await requireStaff();
  const quals = await db.trainerQualification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const STATUS = { PENDING: { label: "En attente de vérification", tone: "gray" }, VALIDATED: { label: "Vérifié", tone: "green" }, REJECTED: { label: "À revoir", tone: "red" } } as const;
  return (
    <Container className="max-w-4xl">
      <PageHeader title="Mes compétences" subtitle="Votre organisme doit pouvoir justifier vos compétences et leur mise à jour (Qualiopi, indicateurs 21 et 22). Déposez votre CV à jour, vos diplômes et les formations que vous suivez." />
      <section className="card p-6">
        <h2 className="mb-4 text-xl">Ajouter un justificatif</h2>
        <QualificationForm />
      </section>
      <section className="card mt-6 p-6">
        <h2 className="text-xl">Mes justificatifs</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {quals.map((q) => {
            const st = STATUS[q.status as keyof typeof STATUS];
            return (
              <li key={q.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-slate-900">{QUALIF_KINDS[q.kind] ?? q.kind} · {q.title}</span>
                  <span className="block text-slate-500">{[q.issuer, q.obtainedAt && formatDate(q.obtainedAt), q.expiresAt && `expire le ${formatDate(q.expiresAt)}`].filter(Boolean).join(" · ")}</span>
                </span>
                <Badge tone={st.tone}>{st.label}</Badge>
                <form action={deleteQualificationAction.bind(null, q.id)}><button className="btn-ghost btn-sm text-red-600">Supprimer</button></form>
              </li>
            );
          })}
          {!quals.length && <li className="py-3 text-sm text-slate-500">Aucun justificatif pour l&apos;instant.</li>}
        </ul>
      </section>
    </Container>
  );
}
