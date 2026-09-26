import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { submitInsertionSurveyAction } from "@/app/actions/surveys";
import { StateForm } from "@/components/StateForm";
import { Field } from "@/components/ui";
import { INSERTION_SITUATIONS } from "@/lib/labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Que devenez-vous ?", robots: { index: false } };

/** Enquête d'insertion à 6 mois (lien personnel reçu par e-mail). */
export default async function InsertionSurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await db.insertionSurvey.findUnique({
    where: { token },
    include: { organization: { select: { name: true } }, enrollment: { select: { course: { select: { title: true } }, user: { select: { name: true } } } } },
  });
  if (!s) notFound();
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="card p-8">
        <div className="eyebrow">{s.organization.name}</div>
        <h1 className="mt-1">Que devenez-vous ?</h1>
        <p className="mt-2 text-sm text-slate-600">
          Il y a {s.horizonMonths} mois, vous avez terminé la formation « {s.enrollment.course.title} ». Trois questions, une minute : vos réponses servent à mesurer
          l&apos;utilité de la formation. Elles sont publiées uniquement sous forme de statistiques anonymes.
        </p>
        <div className="mt-6">
          {s.answeredAt ? (
            <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">Merci, votre réponse est bien enregistrée.</p>
          ) : (
            <StateForm action={submitInsertionSurveyAction.bind(null, token)} submitLabel="Envoyer ma réponse" submitClassName="btn-primary" className="space-y-5">
              <fieldset>
                <legend className="font-medium text-slate-900">Quelle est votre situation aujourd&apos;hui ?</legend>
                <div className="mt-2 space-y-2 text-sm">
                  {Object.entries(INSERTION_SITUATIONS).map(([k, v]) => (
                    <label key={k} className="flex items-start gap-2"><input type="radio" name="situation" value={k} required className="mt-0.5 h-4 w-4" /> {v}</label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="font-medium text-slate-900">Cette situation est-elle en lien avec la formation suivie ?</legend>
                <div className="mt-2 flex gap-6 text-sm">
                  <label className="flex items-center gap-2"><input type="radio" name="relatedToTraining" value="yes" className="h-4 w-4" /> Oui</label>
                  <label className="flex items-center gap-2"><input type="radio" name="relatedToTraining" value="no" className="h-4 w-4" /> Non</label>
                </div>
              </fieldset>
              <Field label="Utilisez-vous les compétences acquises ? (1 = pas du tout, 5 = tous les jours)">
                <select name="skillsUsed" className="input" defaultValue="">
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Un commentaire ? (facultatif)"><textarea name="comment" rows={3} className="input" /></Field>
            </StateForm>
          )}
        </div>
      </div>
    </main>
  );
}
