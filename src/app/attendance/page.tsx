import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { signAttendanceAction } from "@/app/actions/learner-extra";
import { SignaturePad } from "@/components/SignaturePad";
import { Badge, Container, Empty, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { justifyAbsenceAction } from "@/app/actions/absences";
import { StateForm } from "@/components/StateForm";
import { ABSENCE_KINDS, ABSENCE_REASONS, ABSENCE_STATUS } from "@/lib/labels";
import { ACCEPT_ATTR, MAX_UPLOAD_MB } from "@/lib/uploads";

export const metadata = { title: "Émargement" };
export const dynamic = "force-dynamic";

export default async function Attendance() {
  const user = await requireUser();
  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id, sessionId: { not: null }, status: { not: "SUSPENDED" } },
    select: { sessionId: true },
  });
  const sessionIds = enrollments.map((e) => e.sessionId!);
  const slots = await db.attendanceSlot.findMany({
    where: { sessionId: { in: sessionIds } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: {
      session: { select: { name: true, course: { select: { title: true } } } },
      signatures: { where: { userId: user.id } },
      absences: { where: { userId: user.id }, select: { id: true, status: true, reason: true, kind: true, fileName: true } },
    },
  });
  const today = new Date().toISOString().slice(0, 10);
  const todays = slots.filter((s) => s.date.toISOString().slice(0, 10) === today);
  return (
    <Container className="max-w-4xl">
      <PageHeader title="Émargement électronique" subtitle="Signez votre présence pour chaque demi-journée ou classe virtuelle, le jour même." />
      <p className="mb-6 rounded-[10px] bg-brand-50 p-4 text-sm text-brand-700">
        <b className="font-medium">Quand faut-il émarger ?</b> Uniquement pour les temps <b className="font-medium">synchrones</b> : journées en salle et classes virtuelles
        à heure fixe, que votre organisme a planifiées ci-dessous. Pour les modules <b className="font-medium">à distance en autonomie</b>, vous n&apos;avez rien à signer :
        votre temps de connexion et d&apos;activité est enregistré automatiquement et sert de preuve de présence (relevé de connexions).
      </p>
      {slots.length === 0 ? (
        <Empty title="Aucun créneau d'émargement">Votre organisme n&apos;a pas encore planifié de créneau pour vos sessions.</Empty>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3">Aujourd&apos;hui</h2>
            {todays.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun créneau à signer aujourd&apos;hui.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {todays.map((s) => (
                  <div key={s.id} className="card p-4">
                    <div className="text-xs text-slate-500">{s.session.course.title} · {s.session.name}</div>
                    <div className="font-semibold">{s.label} — {s.startTime} à {s.endTime}</div>
                    <div className="mt-3">
                      {s.signatures[0] ? (
                        <div className="flex items-center gap-3">
                          <Badge tone="green">✓ Signé le {formatDate(s.signatures[0].signedAt, true)}</Badge>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.signatures[0].signature} alt="Signature" className="paper-sign h-12" />
                        </div>
                      ) : (
                        <SignaturePad onSign={signAttendanceAction.bind(null, s.id)} label="Je signe ma présence" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-3">Historique et créneaux à venir</h2>
            <div className="card overflow-x-auto">
              <table className="table">
                <thead><tr><th>Date</th><th>Créneau</th><th>Formation</th><th>Statut</th></tr></thead>
                <tbody>
                  {slots.map((s) => {
                    const d = s.date.toISOString().slice(0, 10);
                    return (
                      <tr key={s.id}>
                        <td>{formatDate(s.date)}</td>
                        <td>{s.label} ({s.startTime}–{s.endTime})</td>
                        <td className="text-slate-500">{s.session.course.title}</td>
                        <td>
                          {s.signatures[0] ? <Badge tone="green">Présent(e) – signé</Badge> : s.absences[0] ? (
                            <Badge tone={ABSENCE_STATUS[s.absences[0].status].tone}>{ABSENCE_KINDS[s.absences[0].kind]} · {ABSENCE_STATUS[s.absences[0].status].label}</Badge>
                          ) : d < today ? <Badge tone="red">Non signé</Badge> : d === today ? <Badge tone="amber">À signer</Badge> : <Badge>À venir</Badge>}
                          {!s.signatures[0] && s.absences[0]?.status !== "ACCEPTED" && d <= today && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-medium text-brand-600">Justifier</summary>
                              <StateForm action={justifyAbsenceAction.bind(null, s.id)} submitLabel="Envoyer le justificatif" submitClassName="btn-secondary btn-sm" className="mt-2 space-y-2">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <select name="kind" className="input" defaultValue="ABSENCE">
                                    {Object.entries(ABSENCE_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                  </select>
                                  <select name="reason" className="input" required defaultValue="">
                                    <option value="" disabled>Motif</option>
                                    {Object.entries(ABSENCE_REASONS).filter(([k]) => k !== "NON_JUSTIFIE").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                  </select>
                                </div>
                                <input name="minutes" type="number" min={1} placeholder="Durée en minutes (retard, départ anticipé)" className="input" />
                                <textarea name="comment" rows={2} placeholder="Précisions (facultatif)" className="input" />
                                <label className="block text-xs text-slate-500">Justificatif (PDF ou photo, {MAX_UPLOAD_MB} Mo max.)<input type="file" name="file" accept={ACCEPT_ATTR.document} className="mt-1 block text-sm" /></label>
                              </StateForm>
                            </details>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </Container>
  );
}
