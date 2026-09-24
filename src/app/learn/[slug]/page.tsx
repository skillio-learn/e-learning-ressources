import Link from "next/link";
import { db } from "@/lib/db";
import { getLearnContext } from "@/lib/learn";
import { getLearnerResults } from "@/lib/progress";
import { Badge, Stat } from "@/components/ui";
import { pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CourseHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, course, outline, enrollment, preview } = await getLearnContext(slug);
  const [{ results, average }, certificate] = await Promise.all([
    getLearnerResults(user.id, course.id),
    db.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }),
  ]);
  const first = outline.flat[0];
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 lg:px-10">
      <div>
        <h1 className="text-3xl">{course.title}</h1>
        <p className="mt-2 text-slate-500">
          {course.sequential
            ? "Parcours étape par étape : chaque étape terminée débloque la suivante."
            : "Parcours libre : suivez les leçons dans l'ordre de votre choix."}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Progression" value={`${outline.percent} %`} hint={`${outline.completed}/${outline.total} étapes`} />
        <Stat label="Moyenne aux évaluations" value={pct(average)} hint={`Seuil de validation : ${course.passingScore} %`} />
        <Stat
          label="Statut"
          value={enrollment?.status === "COMPLETED" ? "✅ Validée" : preview ? "Aperçu" : "En cours"}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        {outline.next ? (
          <Link href={`/learn/${course.slug}/${outline.next.id}`} className="btn-primary">
            {outline.completed ? "▶ Reprendre" : "▶ Commencer"} : {outline.next.title}
          </Link>
        ) : first ? (
          <Link href={`/learn/${course.slug}/${first.id}`} className="btn-secondary">Revoir depuis le début</Link>
        ) : (
          <p className="text-slate-500">Cette formation ne contient pas encore de leçon.</p>
        )}
        {certificate && (
          <Link href={`/certificates/${certificate.code}`} className="btn-secondary">🏅 Voir mon certificat</Link>
        )}
      </div>

      {results.length > 0 && (
        <section>
          <h2 className="mb-3">Mes évaluations</h2>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Évaluation</th><th>Type</th><th>Meilleur score</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.lessonId}>
                    <td>
                      <Link href={`/learn/${course.slug}/${r.lessonId}`} className="hover:text-brand-600">{r.title}</Link>
                    </td>
                    <td>{r.kind === "QUIZ" ? "Quiz" : "Devoir"}{!r.counted && <span className="text-xs text-slate-400"> (non noté)</span>}</td>
                    <td className="font-semibold">{pct(r.percent)}</td>
                    <td>
                      {r.pending ? (
                        <Badge tone="amber">En attente de correction</Badge>
                      ) : r.attempts === 0 ? (
                        <Badge>À faire</Badge>
                      ) : r.passed ? (
                        <Badge tone="green">Validé</Badge>
                      ) : (
                        <Badge tone="red">Non validé</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3">Programme</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {outline.modules.map((m, i) => (
            <div key={m.id} className="card p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Module {i + 1}</div>
              <div className="font-semibold">{m.title}</div>
              <div className="mt-2 text-sm text-slate-500">
                {m.completedCount}/{m.lessons.length} leçon(s) terminée(s)
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
