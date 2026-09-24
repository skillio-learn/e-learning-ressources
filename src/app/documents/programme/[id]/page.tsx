import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { DocShell } from "@/components/documents/DocShell";
import { renderMarkdown } from "@/lib/markdown";
import { LEVEL_LABELS, formatDate } from "@/lib/utils";
import { MODALITY_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Programme de formation" };

/** Programme détaillé public (exigence Qualiopi indicateurs 1 à 3, information du public). */
export default async function Programme({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await db.course.findUnique({
    where: { id },
    include: {
      organization: true,
      modules: { orderBy: { position: "asc" }, include: { lessons: { where: { published: true }, orderBy: { position: "asc" }, select: { title: true, durationMin: true, type: true } } } },
      sessions: { where: { open: true, endDate: { gte: new Date() } }, orderBy: { startDate: "asc" } },
    },
  });
  if (!course) notFound();
  if (course.status !== "PUBLISHED") {
    const user = await getCurrentUser();
    if (!user || !(await canManageCourse(user, course.id))) notFound();
  }
  const md = (t: string | null) => (t ? <div className="prose-lms text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(t) }} /> : <p className="text-slate-400">—</p>);
  const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mt-5"><h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-brand-800">{title}</h2>{children}</section>
  );
  const totalMin = course.modules.reduce((s, m) => s + m.lessons.reduce((t, l) => t + (l.durationMin ?? 0), 0), 0);
  return (
    <DocShell org={course.organization} title={course.title} subtitle={`Programme de formation – mis à jour le ${formatDate(course.updatedAt)}`}>
      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr><td className="w-56 border px-3 py-1.5 text-slate-600">Durée</td><td className="border px-3 py-1.5">{course.durationHours ?? Math.round(totalMin / 6) / 10} heures</td></tr>
          <tr><td className="border px-3 py-1.5 text-slate-600">Modalité</td><td className="border px-3 py-1.5">{MODALITY_LABELS[course.modality]}</td></tr>
          <tr><td className="border px-3 py-1.5 text-slate-600">Niveau</td><td className="border px-3 py-1.5">{LEVEL_LABELS[course.level]}</td></tr>
          {course.rncpCode && <tr><td className="border px-3 py-1.5 text-slate-600">Certification</td><td className="border px-3 py-1.5">{course.rncpCode}</td></tr>}
          <tr><td className="border px-3 py-1.5 text-slate-600">Tarif</td><td className="border px-3 py-1.5">{course.price != null ? `${course.price.toLocaleString("fr-FR")} € HT` : "Sur devis"}{course.cpfEligible ? " · éligible CPF" : ""}</td></tr>
          <tr><td className="border px-3 py-1.5 text-slate-600">Délai d&apos;accès</td><td className="border px-3 py-1.5">Entrée après validation du dossier (délai indicatif : 14 jours ; 11 jours ouvrés minimum pour un financement CPF)</td></tr>
          {course.sessions.length > 0 && (
            <tr><td className="border px-3 py-1.5 text-slate-600">Prochaines sessions</td><td className="border px-3 py-1.5">{course.sessions.map((s) => `${formatDate(s.startDate)} → ${formatDate(s.endDate)}`).join(" ; ")}</td></tr>
          )}
        </tbody>
      </table>
      <Sec title="Objectifs pédagogiques">{md(course.objectives)}</Sec>
      {course.skills.length > 0 && <Sec title="Compétences visées"><ul className="list-disc pl-5 text-sm">{course.skills.map((s) => <li key={s}>{s}</li>)}</ul></Sec>}
      <Sec title="Public visé">{md(course.audience)}</Sec>
      <Sec title="Prérequis">{md(course.prerequisites)}</Sec>
      <Sec title="Contenu de la formation">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {course.modules.map((m) => (
            <li key={m.id}>
              <b>{m.title}</b>
              {m.description && <div className="text-slate-600">{m.description}</div>}
              <ul className="ml-4 list-disc text-slate-700">
                {m.lessons.map((l, i) => <li key={i}>{l.title}{l.durationMin ? ` (${l.durationMin} min)` : ""}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </Sec>
      <Sec title="Méthodes et moyens pédagogiques">
        {md(course.pedagogicalMethods ?? "Parcours en ligne étape par étape : modules interactifs, vidéos, ressources téléchargeables, quiz et mises en situation. Assistance pédagogique et technique par messagerie. Suivi de la progression et du temps de formation.")}
      </Sec>
      <Sec title="Modalités d'évaluation">
        {md(course.evaluationMethods ?? "Positionnement à l'entrée, quiz et mises en situation évaluées par grille critériée, auto-évaluation de fin de formation, questionnaires de satisfaction à chaud et à froid. Certificat de réalisation délivré à l'issue de la formation.")}
      </Sec>
      <Sec title="Accessibilité">
        <p className="text-sm">
          Formation accessible aux personnes en situation de handicap ; les aménagements sont étudiés au cas par cas{course.organization.referentHandicap ? ` avec notre référent handicap : ${course.organization.referentHandicap}` : ""}.
        </p>
      </Sec>
      <Sec title="Contact">
        <p className="text-sm">{course.organization.name} — {course.organization.email ?? ""} {course.organization.phone ?? ""}</p>
      </Sec>
    </DocShell>
  );
}
