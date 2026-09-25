import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileCheck2, FileText, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { getLearnContext } from "@/lib/learn";
import { Badge } from "@/components/ui";
import { ENROLLMENT_DOCUMENTS } from "@/lib/labels";
import { formatDate, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes documents" };

/** Documents de l'apprenant pour une formation : fin de formation, inscription, résultats de quiz et devoirs. */
export default async function LearnerDocuments({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, course, enrollment, preview } = await getLearnContext(slug);
  if (!enrollment || preview) notFound();
  const finished = enrollment.status === "COMPLETED" || enrollment.status === "ABANDONED" || !!enrollment.exitDate;
  const [signedDocs, attempts, submissions] = await Promise.all([
    db.learnerDocument.findMany({
      where: { enrollmentId: enrollment.id, status: { not: "REJECTED" } },
      orderBy: { createdAt: "asc" },
      select: { id: true, type: true, source: true, status: true, fileName: true, createdAt: true },
    }),
    db.quizAttempt.findMany({
      where: { userId: user.id, status: { not: "IN_PROGRESS" }, quiz: { lesson: { module: { courseId: course.id } } } },
      orderBy: { submittedAt: "desc" },
      select: { id: true, percent: true, passed: true, status: true, submittedAt: true, quiz: { select: { lesson: { select: { title: true } } } } },
    }),
    db.submission.findMany({
      where: { userId: user.id, lesson: { module: { courseId: course.id } } },
      orderBy: { submittedAt: "desc" },
      select: { id: true, status: true, submittedAt: true, percent: true, feedback: true, fileName: true, lesson: { select: { id: true, title: true } } },
    }),
  ]);

  const Doc = ({ title, hint, href, pdf, locked }: { title: string; hint: string; href?: string; pdf?: string; locked?: boolean }) => (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500">
        {locked ? <Lock className="h-4 w-4" strokeWidth={1.75} /> : <FileCheck2 className="h-5 w-5" strokeWidth={1.75} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{hint}</div>
      </div>
      {!locked && (
        <span className="flex gap-2">
          {href && <Link href={href} className="btn-ghost btn-sm">Consulter</Link>}
          {pdf && <a href={pdf} className="btn-primary btn-sm"><Download className="h-4 w-4" strokeWidth={1.75} /> PDF</a>}
        </span>
      )}
    </li>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 lg:px-10">
      <div>
        <h1 className="text-3xl">Mes documents</h1>
        <p className="mt-2 text-slate-500">{course.title}</p>
      </div>

      <section className="space-y-3">
        <h2>Fin de formation</h2>
        {!finished && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Votre attestation de réalisation et le relevé de vos connexions seront téléchargeables dès que la formation sera terminée.
          </p>
        )}
        <ul className="space-y-2">
          <Doc
            title="Certificat de réalisation"
            hint="Justificatif officiel de la formation suivie (durée réalisée), utilisé par les financeurs."
            href={`/documents/realisation/${enrollment.id}`}
            pdf={`/api/pdf/enrollments/${enrollment.id}/realisation`}
            locked={!finished}
          />
          <Doc
            title="Relevé de connexions et de temps de formation"
            hint="Journal horodaté de vos connexions et du temps passé sur chaque étape."
            href={`/documents/releve/${enrollment.id}`}
            pdf={`/api/pdf/enrollments/${enrollment.id}/releve`}
            locked={!finished}
          />
        </ul>
      </section>

      <section className="space-y-3">
        <h2>Inscription</h2>
        <ul className="space-y-2">
          <Doc title="Convention / contrat de formation" hint={enrollment.conventionSignedAt ? `Signée le ${formatDate(enrollment.conventionSignedAt, true)}` : "À signer"} href={`/documents/convention/${enrollment.id}`} />
          {signedDocs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm">
              <FileText className="h-5 w-5 text-slate-400" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="font-medium text-slate-900">{ENROLLMENT_DOCUMENTS[d.type]?.label ?? d.type}</span>
                <span className="block text-xs text-slate-500">{d.source === "E_SIGNATURE" ? "Signé en ligne" : d.fileName} · {formatDate(d.createdAt, true)}</span>
              </span>
              <Badge tone={d.status === "VALIDATED" ? "green" : "amber"}>{d.status === "VALIDATED" ? "Validé" : "En vérification"}</Badge>
              <a href={d.source === "E_SIGNATURE" ? `/documents/signed/${d.id}` : `/api/learner-documents/${d.id}?inline=1`} target="_blank" className="btn-ghost btn-sm">Ouvrir</a>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2>Résultats de quiz</h2>
        {attempts.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun quiz remis pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {attempts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-slate-900">{a.quiz.lesson.title}</span>
                  <span className="block text-xs text-slate-500">Remis le {formatDate(a.submittedAt, true)}</span>
                </span>
                <Badge tone={a.status === "PENDING_REVIEW" ? "amber" : a.passed ? "green" : "red"}>
                  {a.status === "PENDING_REVIEW" ? `${pct(a.percent)} · correction en cours` : `${pct(a.percent)} · ${a.passed ? "réussi" : "non validé"}`}
                </Badge>
                <a href={`/api/pdf/attempts/${a.id}`} className="btn-secondary btn-sm"><Download className="h-4 w-4" strokeWidth={1.75} /> PDF</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2>Mes devoirs</h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun devoir remis pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {submissions.map((s) => (
              <li key={s.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/learn/${course.slug}/${s.lesson.id}`} className="min-w-0 flex-1 font-medium text-slate-900 hover:text-brand-600">{s.lesson.title}</Link>
                  <Badge tone={s.status === "GRADED" ? "green" : s.status === "NEEDS_REVISION" ? "amber" : "blue"}>
                    {s.status === "GRADED" ? `Corrigé · ${pct(s.percent)}` : s.status === "NEEDS_REVISION" ? "À reprendre" : "En attente de correction"}
                  </Badge>
                  {s.fileName && <a href={`/api/submissions/${s.id}/file`} className="btn-ghost btn-sm">Mon fichier</a>}
                </div>
                {s.feedback && <p className="mt-2 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-slate-700">{s.feedback}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
