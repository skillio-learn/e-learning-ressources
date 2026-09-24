import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getLearnContext } from "@/lib/learn";
import { submitSatisfactionAction } from "@/app/actions/learner-extra";
import { SatisfactionForm } from "@/components/learn/SatisfactionForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Questionnaire de satisfaction" };

export default async function SatisfactionPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { slug } = await params;
  const kind = (await searchParams).kind === "COLD" ? "COLD" : "HOT";
  const { enrollment, course } = await getLearnContext(slug);
  if (!enrollment) notFound();
  const existing = await db.satisfactionResponse.findUnique({ where: { enrollmentId_kind: { enrollmentId: enrollment.id, kind } } });
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-10">
      <h1>{kind === "COLD" ? "Évaluation à froid" : "Questionnaire de satisfaction"}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        {kind === "COLD"
          ? `Quelques semaines après « ${course.title} », dites-nous ce que vous avez mis en pratique.`
          : `Votre avis sur « ${course.title} ».`}
      </p>
      <div className="card p-6">
        {existing ? <p className="text-emerald-700">Merci, vous avez déjà répondu à ce questionnaire.</p> : <SatisfactionForm action={submitSatisfactionAction.bind(null, enrollment.id, kind)} />}
      </div>
    </div>
  );
}
