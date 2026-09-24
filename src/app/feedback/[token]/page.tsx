import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { submitFunderFeedbackAction } from "@/app/actions/compliance";
import { FunderFeedbackForm } from "@/components/FunderFeedbackForm";
import { RESPONDENT_TYPES } from "@/lib/labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Évaluation de la formation" };

/** Questionnaire public (sans compte) pour employeurs et financeurs — Qualiopi indicateur 30. */
export default async function FunderFeedback({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const fb = await db.funderFeedback.findUnique({
    where: { token },
    include: { organization: { select: { name: true } }, enrollment: { select: { course: { select: { title: true } }, user: { select: { name: true } } } } },
  });
  if (!fb) notFound();
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="card p-8">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{fb.organization.name}</div>
        <h1 className="mt-1">Votre évaluation de la formation</h1>
        <p className="mt-2 text-sm text-slate-600">
          {fb.enrollment ? <>Formation « {fb.enrollment.course.title} » suivie par {fb.enrollment.user.name}. </> : null}
          Vous répondez en tant que : <b>{RESPONDENT_TYPES[fb.respondentType]}</b>. Merci de consacrer 2 minutes à ce questionnaire : il contribue à l&apos;amélioration
          continue de nos formations.
        </p>
        <div className="mt-6">
          {fb.answeredAt ? (
            <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">Merci, votre évaluation a bien été enregistrée.</p>
          ) : (
            <FunderFeedbackForm action={submitFunderFeedbackAction.bind(null, token)} defaultName={fb.respondentName ?? ""} />
          )}
        </div>
      </div>
    </main>
  );
}
