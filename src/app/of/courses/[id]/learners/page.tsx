import Link from "next/link";
import { db } from "@/lib/db";
import { enrollLearnersAction, removeEnrollmentAction, setEnrollmentStatusAction } from "@/app/actions/of";
import { getCourseOutline, getLearnerResults } from "@/lib/progress";
import { EnrollForm } from "@/components/of/EnrollForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Empty, ProgressBar } from "@/components/ui";
import { formatDate, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CourseLearners({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const enrollments = await db.enrollment.findMany({
    where: { courseId: id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { enrolledAt: "desc" },
  });
  const rows = await Promise.all(
    enrollments.map(async (e) => {
      const [outline, results] = await Promise.all([getCourseOutline(id, e.userId, { ignoreLocks: true }), getLearnerResults(e.userId, id)]);
      return { e, percent: outline?.percent ?? 0, average: results.average, pending: results.results.some((r) => r.pending) };
    }),
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        {rows.length === 0 ? (
          <Empty title="Aucun apprenant inscrit">Utilisez le formulaire pour inscrire vos apprenants.</Empty>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Apprenant</th><th>Progression</th><th>Moyenne</th><th>Statut</th><th>Dernière activité</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map(({ e, percent, average, pending }) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/of/courses/${id}/learners/${e.userId}`} className="font-medium hover:text-brand-700">{e.user.name}</Link>
                      <div className="text-xs text-slate-500">{e.user.email}</div>
                    </td>
                    <td className="w-40">
                      <ProgressBar value={percent} />
                      <div className="mt-1 text-xs text-slate-500">{percent} %</div>
                    </td>
                    <td className="font-semibold">{pct(average)}{pending && <div className="text-xs font-normal text-amber-600">correction en attente</div>}</td>
                    <td>
                      {e.status === "COMPLETED" ? <Badge tone="green">Validée</Badge> : e.status === "SUSPENDED" ? <Badge tone="red">Suspendu</Badge> : <Badge tone="blue">En cours</Badge>}
                    </td>
                    <td className="text-xs text-slate-500">{formatDate(e.lastActivityAt ?? e.enrolledAt, true)}</td>
                    <td className="whitespace-nowrap text-right">
                      <Link href={`/of/courses/${id}/learners/${e.userId}`} className="btn-ghost btn-sm">Détail</Link>
                      {e.status === "SUSPENDED" ? (
                        <form action={setEnrollmentStatusAction.bind(null, e.id, "ACTIVE")} className="inline"><button className="btn-ghost btn-sm">Réactiver</button></form>
                      ) : (
                        <form action={setEnrollmentStatusAction.bind(null, e.id, "SUSPENDED")} className="inline"><button className="btn-ghost btn-sm">Suspendre</button></form>
                      )}
                      <form action={removeEnrollmentAction.bind(null, e.id)} className="inline">
                        <SubmitButton className="btn-ghost btn-sm text-red-600" pendingLabel="…" confirm={`Désinscrire ${e.user.name} ?`}>✕</SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <aside>
        <EnrollForm action={enrollLearnersAction.bind(null, id)} />
      </aside>
    </div>
  );
}
