import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOfManager } from "@/lib/auth";
import {
  cancelCompanyConventionAction,
  createCompanyConventionAction,
  inviteCompanyContactAction,
  requestCompanyFeedbackAction,
  saveNeedsAnalysisAction,
  setCompanyContactActiveAction,
  updateCompanyAction,
  updateCompanySharingAction,
} from "@/app/actions/companies";
import { CompanyFields } from "@/components/of/CompanyFields";
import { StateForm } from "@/components/StateForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Container, Field, PageHeader } from "@/components/ui";
import { ENROLLMENT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entreprise" };

const SHARE = [
  ["shareProgress", "Progression dans le parcours (% d'étapes terminées)"],
  ["shareTime", "Temps de formation réalisé (heures)"],
  ["shareAttendance", "Assiduité (émargements, absences)"],
  ["shareAbsenceAlerts", "Alertes d'absences non justifiées"],
  ["shareResults", "Résultats aux évaluations (notes)"],
  ["shareDocuments", "Documents : convocations, attestations, certificats de réalisation"],
] as const;

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireOfManager();
  const c = await db.company.findFirst({
    where: { id, organizationId: user.organizationId ?? "__" },
    include: {
      contacts: { orderBy: { name: "asc" }, select: { id: true, name: true, email: true, active: true, lastLoginAt: true } },
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        include: { user: { select: { id: true, name: true } }, course: { select: { title: true } }, session: { select: { name: true } }, feedbacks: { where: { respondentType: "EMPLOYER" }, select: { answeredAt: true, createdAt: true } } },
      },
      conventions: { orderBy: { createdAt: "desc" }, include: { session: { select: { name: true } } } },
      needsAnalyses: { include: { session: { select: { id: true, name: true } } } },
    },
  });
  if (!c) notFound();
  const sessionIds = new Set([...c.enrollments.map((e) => e.sessionId).filter(Boolean) as string[]]);
  const sessions = await db.trainingSession.findMany({
    where: { OR: [{ companyId: c.id }, { id: { in: [...sessionIds] } }] },
    orderBy: { startDate: "desc" },
    include: { course: { select: { title: true, durationHours: true } } },
  });

  return (
    <Container>
      <PageHeader
        back={{ href: "/of/companies", label: "Entreprises" }}
        title={c.name}
        subtitle={[c.legalName, c.siret && `SIRET ${c.siret}`, c.opcoName && `OPCO ${c.opcoName}`].filter(Boolean).join(" · ") || undefined}
        actions={!c.active ? <Badge>Inactive</Badge> : undefined}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-4 text-xl">Fiche entreprise</h2>
          <StateForm action={updateCompanyAction.bind(null, c.id)} submitLabel="Enregistrer" submitClassName="btn-secondary" className="space-y-3">
            <CompanyFields c={c} />
          </StateForm>
        </section>
        <section className="card p-6">
          <h2 className="text-xl">Espace entreprise : ce que voit l&apos;entreprise</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">L&apos;entreprise ne voit que ses propres salariés. Limitez le partage au nécessaire (RGPD) : les salariés en sont informés par les CGU et la convention.</p>
          <StateForm action={updateCompanySharingAction.bind(null, c.id)} submitLabel="Enregistrer le paramétrage" submitClassName="btn-primary" className="space-y-3">
            {SHARE.map(([k, label]) => (
              <label key={k} className="flex items-start gap-3 text-sm"><input type="checkbox" name={k} defaultChecked={c[k]} className="mt-0.5 h-4 w-4" /> {label}</label>
            ))}
            <label className="flex items-start gap-3 border-t border-slate-200 pt-3 text-sm"><input type="checkbox" name="active" defaultChecked={c.active} className="mt-0.5 h-4 w-4" /> Entreprise active</label>
          </StateForm>

          <h3 className="mt-6 text-lg">Contacts ayant accès à l&apos;espace</h3>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {c.contacts.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-0 flex-1"><span className="font-medium text-slate-900">{u.name}</span> <span className="text-slate-500">{u.email} · {u.lastLoginAt ? `connecté le ${formatDate(u.lastLoginAt)}` : "jamais connecté"}</span></span>
                {!u.active && <Badge>Désactivé</Badge>}
                <form action={setCompanyContactActiveAction.bind(null, u.id, !u.active)}><button className="btn-ghost btn-sm">{u.active ? "Désactiver" : "Réactiver"}</button></form>
              </li>
            ))}
            {!c.contacts.length && <li className="py-2 text-slate-500">Aucun contact invité.</li>}
          </ul>
          <StateForm action={inviteCompanyContactAction.bind(null, c.id)} submitLabel="Inviter" submitClassName="btn-secondary" className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Nom"><input name="name" required defaultValue={c.contactName ?? ""} className="input" /></Field>
            <Field label="E-mail"><input name="email" type="email" required defaultValue={c.contactEmail ?? ""} className="input" /></Field>
          </StateForm>
        </section>
      </div>

      <section className="card mt-6 overflow-x-auto">
        <div className="px-6 pt-5"><h2 className="text-xl">Salariés en formation ({c.enrollments.length})</h2><p className="text-sm text-slate-500">Rattachez un salarié depuis sa fiche apprenant (inscription) ou lors de sa création.</p></div>
        <table className="table mt-3">
          <thead><tr><th>Salarié</th><th>Formation</th><th>Statut</th><th>Évaluation par l&apos;entreprise</th></tr></thead>
          <tbody>
            {c.enrollments.map((e) => {
              const fb = e.feedbacks[0];
              return (
                <tr key={e.id}>
                  <td><Link href={`/of/learners/${e.user.id}`} className="font-medium text-brand-600 hover:underline">{e.user.name}</Link></td>
                  <td>{e.course.title}{e.session ? <div className="text-xs text-slate-500">{e.session.name}</div> : null}</td>
                  <td><Badge tone={ENROLLMENT_STATUS[e.status].tone}>{ENROLLMENT_STATUS[e.status].label}</Badge></td>
                  <td>
                    {fb?.answeredAt ? <Badge tone="green">Reçue le {formatDate(fb.answeredAt)}</Badge> : fb ? <Badge tone="amber">Demandée le {formatDate(fb.createdAt)}</Badge> : (
                      <form action={requestCompanyFeedbackAction.bind(null, e.id)}><SubmitButton className="btn-ghost btn-sm">Demander son avis</SubmitButton></form>
                    )}
                  </td>
                </tr>
              );
            })}
            {!c.enrollments.length && <tr><td colSpan={4} className="text-slate-500">Aucun salarié rattaché.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="text-xl">Sessions, besoins et conventions</h2>
        {sessions.length === 0 && <p className="text-sm text-slate-500">Aucune session intra ni salarié inscrit pour l&apos;instant. Créez une session intra depuis « Sessions et émargement ».</p>}
        {sessions.map((s) => {
          const na = c.needsAnalyses.find((n) => n.sessionId === s.id);
          const convs = c.conventions.filter((v) => v.sessionId === s.id);
          const trainees = c.enrollments.filter((e) => e.sessionId === s.id).map((e) => e.user.name);
          return (
            <article key={s.id} className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg"><Link href={`/of/sessions/${s.id}`} className="hover:underline">{s.name}</Link></h3>
                  <p className="text-sm text-slate-500">{s.course.title} · {s.format === "INTRA" ? "Intra-entreprise" : "Inter-entreprises"} · du {formatDate(s.startDate)} au {formatDate(s.endDate)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={na?.validatedAt ? "green" : na ? "amber" : "red"}>{na?.validatedAt ? "Besoin analysé" : na ? "Besoin à valider" : "Besoin non recueilli"}</Badge>
                  {convs.some((v) => v.status === "SIGNED") ? <Badge tone="green">Convention signée</Badge> : convs.some((v) => v.status === "SENT") ? <Badge tone="amber">Convention à signer</Badge> : <Badge>Pas de convention</Badge>}
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <details className="rounded-[10px] border border-slate-200 p-4" open={!!na && !na.validatedAt}>
                  <summary className="cursor-pointer font-medium text-brand-600">Analyse du besoin (indicateur 4)</summary>
                  <StateForm action={saveNeedsAnalysisAction.bind(null, c.id, s.id)} submitLabel="Enregistrer" submitClassName="btn-secondary" className="mt-3 space-y-3">
                    <Field label="Contexte et situation de départ"><textarea name="context" rows={3} required defaultValue={na?.context ?? ""} className="input" /></Field>
                    <Field label="Objectifs attendus par l'entreprise"><textarea name="objectives" rows={3} required defaultValue={na?.objectives ?? ""} className="input" /></Field>
                    <Field label="Contraintes (dates, lieu, public, handicap…)"><textarea name="constraints" rows={2} defaultValue={na?.constraints ?? ""} className="input" /></Field>
                    <Field label="Adaptations proposées par l'organisme"><textarea name="adaptations" rows={2} defaultValue={na?.adaptations ?? ""} className="input" /></Field>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="validate" defaultChecked={!!na?.validatedAt} className="h-4 w-4" /> Analyse validée</label>
                    {na && <p className="text-xs text-slate-500">Saisie par {na.filledByRole === "COMPANY" ? "l'entreprise" : "l'organisme"} le {formatDate(na.createdAt)}{na.validatedAt ? `, validée le ${formatDate(na.validatedAt)}` : ""}.</p>}
                  </StateForm>
                </details>
                <div className="rounded-[10px] border border-slate-200 p-4">
                  <div className="font-medium text-slate-900">Conventions</div>
                  <ul className="mt-2 space-y-2 text-sm">
                    {convs.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center gap-2">
                        <Link href={`/documents/convention-entreprise/${v.id}`} className="link">{v.reference}</Link>
                        <Badge tone={v.status === "SIGNED" ? "green" : v.status === "SENT" ? "amber" : "gray"}>{v.status === "SIGNED" ? `Signée le ${formatDate(v.signedAt)} par ${v.signerName}` : v.status === "SENT" ? "En attente de signature" : "Annulée"}</Badge>
                        {v.status === "SENT" && <form action={cancelCompanyConventionAction.bind(null, v.id)}><button className="btn-ghost btn-sm text-red-600">Annuler</button></form>}
                      </li>
                    ))}
                    {!convs.length && <li className="text-slate-500">Aucune convention.</li>}
                  </ul>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-brand-600">Émettre une convention</summary>
                    <StateForm action={createCompanyConventionAction.bind(null, c.id)} submitLabel="Émettre et envoyer à signer" submitClassName="btn-primary" className="mt-3 space-y-3">
                      <input type="hidden" name="sessionId" value={s.id} />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Durée (h / stagiaire)"><input name="hours" inputMode="decimal" defaultValue={s.course.durationHours ?? ""} className="input" /></Field>
                        <Field label="Prix HT"><input name="price" inputMode="decimal" defaultValue={s.price ?? ""} className="input" /></Field>
                        <Field label="TVA (%)"><input name="vatRate" inputMode="decimal" defaultValue={20} className="input" /></Field>
                      </div>
                      <Field label="Stagiaires (un par ligne)"><textarea name="trainees" rows={3} defaultValue={trainees.join("\n")} className="input" /></Field>
                      <Field label="Modalités de règlement (facultatif)"><textarea name="paymentTerms" rows={2} className="input" placeholder="Par défaut : règlement à réception de facture, prise en charge OPCO à demander par l'entreprise." /></Field>
                    </StateForm>
                  </details>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </Container>
  );
}
