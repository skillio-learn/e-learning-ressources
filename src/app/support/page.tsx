import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createComplaintAction } from "@/app/actions/learner-extra";
import { StateForm } from "@/components/StateForm";
import { Badge, Container, Field, PageHeader } from "@/components/ui";
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { OpenSupportButton } from "@/components/support/OpenSupportButton";

export const metadata = { title: "Aide & réclamations" };
export const dynamic = "force-dynamic";

export default async function Support() {
  const user = await requireUser();
  // Espace apprenant : les équipes ont leurs propres outils d'assistance
  if (user.role === "ADMIN") redirect("/admin/support");
  if (user.role === "OF_ADMIN") redirect("/of/tickets");
  if (user.role === "TRAINER") redirect("/of/support");
  const [courses, complaints] = await Promise.all([
    db.course.findMany({
      where: { OR: [{ enrollments: { some: { userId: user.id } } }, { applications: { some: { userId: user.id } } }] },
      select: { id: true, title: true },
    }),
    db.complaint.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { course: { select: { title: true } } } }),
  ]);
  return (
    <Container className="max-w-5xl">
      <PageHeader
        title="Aide, questions & réclamations"
        subtitle="Une question pédagogique, un problème technique, une réclamation ? L'organisme de formation vous répond et trace le traitement de votre demande."
      />
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2>Chat d&apos;assistance</h2>
          <p className="mt-1 text-sm text-slate-500">Pour une question rapide (inscription, accès, technique, financement) : échangez directement avec l&apos;équipe.</p>
        </div>
        <OpenSupportButton />
      </div>
      <h2 className="mb-3 text-base text-slate-600">Réclamation formelle</h2>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="card p-6">
          <h2 className="mb-4">Nouvelle demande</h2>
          <StateForm action={createComplaintAction} submitLabel="Envoyer ma demande">
            <Field label="Catégorie">
              <select name="category" className="input">
                {COMPLAINT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Formation concernée">
              <select name="courseId" className="input">
                <option value="">— Aucune / général —</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </Field>
            <Field label="Objet"><input name="subject" required className="input" /></Field>
            <Field label="Message"><textarea name="message" required rows={6} className="input" /></Field>
          </StateForm>
        </div>
        <div className="space-y-3">
          <h2>Mes demandes</h2>
          {complaints.length === 0 && <p className="text-sm text-slate-500">Aucune demande pour le moment.</p>}
          {complaints.map((c) => (
            <div key={c.id} className="card p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-500">{c.category} · {formatDate(c.createdAt, true)}{c.course ? ` · ${c.course.title}` : ""}</div>
                  <div className="font-semibold">{c.subject}</div>
                </div>
                <Badge tone={COMPLAINT_STATUS[c.status].tone}>{COMPLAINT_STATUS[c.status].label}</Badge>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-slate-600">{c.message}</p>
              {c.response && (
                <div className="mt-3 rounded-lg bg-brand-50 p-3">
                  <div className="text-xs font-semibold text-brand-800">Réponse de l&apos;organisme {c.resolvedAt ? `(${formatDate(c.resolvedAt)})` : ""}</div>
                  <p className="mt-1 whitespace-pre-wrap">{c.response}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
