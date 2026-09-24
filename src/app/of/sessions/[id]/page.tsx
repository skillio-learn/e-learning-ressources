import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { addSlotAction, deleteSessionAction, deleteSlotAction, generateSlotsAction, updateSessionAction } from "@/app/actions/of-admin";
import { StateForm } from "@/components/StateForm";
import { SubmitButton } from "@/components/SubmitButton";
import { PrintButton } from "@/components/PrintButton";
import { SignaturePad } from "@/components/SignaturePad";
import { signSlotAsTrainerAction } from "@/app/actions/compliance";
import { Badge, Container } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Session" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff();
  const s = await db.trainingSession.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, title: true, organization: true } },
      enrollments: { include: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } },
      slots: { orderBy: [{ date: "asc" }, { startTime: "asc" }], include: { signatures: { select: { userId: true, signature: true, signedAt: true } } } },
    },
  });
  if (!s || !(await canManageCourse(user, s.courseId))) notFound();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = iso(new Date());
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  return (
    <Container className="max-w-[1400px]">
      <div className="no-print">
        <Link href="/of/sessions" className="text-sm text-slate-500 hover:text-brand-600">← Sessions</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1>{s.name}</h1>
            <p className="text-sm text-slate-500">{s.course.title} · du {formatDate(s.startDate)} au {formatDate(s.endDate)} · {s.enrollments.length}{s.capacity ? `/${s.capacity}` : ""} inscrit(s)</p>
          </div>
          <PrintButton label="Feuille d'émargement (PDF)" />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="card p-4">
            <h2 className="mb-2 text-base">Paramètres</h2>
            <StateForm action={updateSessionAction.bind(null, s.id)}>
              <input name="name" defaultValue={s.name} className="input" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" name="startDate" defaultValue={iso(s.startDate)} className="input" />
                <input type="date" name="endDate" defaultValue={iso(s.endDate)} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="capacity" type="number" defaultValue={s.capacity ?? ""} placeholder="Places" className="input" />
                <input name="location" defaultValue={s.location ?? ""} placeholder="Lieu" className="input" />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="open" defaultChecked={s.open} /> Ouverte aux candidatures</label>
            </StateForm>
            {s.enrollments.length === 0 && (
              <form action={deleteSessionAction.bind(null, s.id)} className="mt-3">
                <SubmitButton className="btn-ghost btn-sm text-red-600" confirm="Supprimer cette session ?">Supprimer la session</SubmitButton>
              </form>
            )}
          </div>
          <div className="card p-4">
            <h2 className="mb-2 text-base">Générer les créneaux d&apos;émargement</h2>
            <StateForm action={generateSlotsAction.bind(null, s.id)} submitLabel="Générer">
              <div className="grid grid-cols-2 gap-2">
                <input type="date" name="from" defaultValue={iso(s.startDate)} className="input" />
                <input type="date" name="to" defaultValue={iso(s.endDate)} className="input" />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <label key={d} className="flex items-center gap-1"><input type="checkbox" name="weekday" value={d} defaultChecked={d >= 1 && d <= 5} /> {days[d]}</label>
                ))}
              </div>
              <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-xs">
                <label className="flex items-center gap-1"><input type="checkbox" name="morning" defaultChecked /> Matin</label>
                <input name="morningStart" defaultValue="09:00" className="input py-1" />
                <input name="morningEnd" defaultValue="12:30" className="input py-1" />
                <label className="flex items-center gap-1"><input type="checkbox" name="afternoon" defaultChecked /> Après-midi</label>
                <input name="afternoonStart" defaultValue="13:30" className="input py-1" />
                <input name="afternoonEnd" defaultValue="17:00" className="input py-1" />
              </div>
            </StateForm>
          </div>
          <div className="card p-4">
            <h2 className="mb-2 text-base">Ajouter un créneau (classe virtuelle…)</h2>
            <StateForm action={addSlotAction.bind(null, s.id)} submitLabel="Ajouter">
              <input type="date" name="date" required className="input" />
              <input name="label" placeholder="Classe virtuelle" className="input" />
              <div className="grid grid-cols-2 gap-2">
                <input name="startTime" defaultValue="14:00" className="input" />
                <input name="endTime" defaultValue="16:00" className="input" />
              </div>
            </StateForm>
          </div>
        </div>
      </div>

            {/* Signature du formateur pour les créneaux du jour */}
      {s.slots.some((sl) => iso(sl.date) === today && !sl.trainerSignature) && (
        <section className="no-print mt-6 card p-4">
          <h2 className="mb-2 text-base">Signature du formateur – créneaux du jour</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {s.slots.filter((sl) => iso(sl.date) === today && !sl.trainerSignature).map((sl) => (
              <div key={sl.id}>
                <div className="mb-1 text-sm font-medium">{sl.label} ({sl.startTime}–{sl.endTime})</div>
                <SignaturePad onSign={signSlotAsTrainerAction.bind(null, sl.id)} label="Signer en tant que formateur" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Feuille d'émargement (écran + impression) */}
      <section className="mt-8">
        <div className="hidden print:mb-4 print:block">
          <div className="text-sm font-bold">{s.course.organization.legalName || s.course.organization.name}{s.course.organization.nda ? ` – NDA ${s.course.organization.nda}` : ""}</div>
          <h1 className="text-lg font-bold">Feuille d&apos;émargement – {s.course.title}</h1>
          <div className="text-xs">{s.name} · du {formatDate(s.startDate)} au {formatDate(s.endDate)} · {s.location ?? ""}</div>
        </div>
        <h2 className="no-print mb-3">Présences ({s.slots.length} créneau(x))</h2>
        {s.slots.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun créneau. Générez les créneaux ci-dessus.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 border bg-slate-100 px-2 py-1 text-left">Stagiaire</th>
                  {s.slots.map((sl) => (
                    <th key={sl.id} className="min-w-[90px] border bg-slate-50 px-1 py-1 font-normal">
                      <div className="font-semibold">{formatDate(sl.date)}</div>
                      <div>{sl.label} {sl.startTime}-{sl.endTime}</div>
                      {sl.signatures.length === 0 && iso(sl.date) >= today && (
                        <form action={deleteSlotAction.bind(null, sl.id)} className="no-print">
                          <button className="text-[10px] text-red-500 hover:underline">supprimer</button>
                        </form>
                      )}
                    </th>
                  ))}
                  <th className="border bg-slate-100 px-2 py-1">Taux</th>
                </tr>
              </thead>
              <tbody>
                {s.enrollments.map((e) => {
                  const past = s.slots.filter((sl) => iso(sl.date) <= today);
                  const signed = s.slots.filter((sl) => sl.signatures.some((x) => x.userId === e.userId)).length;
                  return (
                    <tr key={e.id}>
                      <td className="sticky left-0 border bg-surface px-2 py-1 font-medium">
                        <Link href={`/of/learners/${e.user.id}`} className="hover:underline">{e.user.name}</Link>
                      </td>
                      {s.slots.map((sl) => {
                        const sig = sl.signatures.find((x) => x.userId === e.userId);
                        const d = iso(sl.date);
                        return (
                          <td key={sl.id} className="h-12 border px-1 text-center">
                            {sig ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={sig.signature} alt="✓" title={`Signé le ${formatDate(sig.signedAt, true)}`} className="paper-sign mx-auto h-9" />
                            ) : d < today ? (
                              <span className="text-red-500">Absent</span>
                            ) : d === today ? (
                              <span className="text-amber-600">En attente</span>
                            ) : (
                              ""
                            )}
                          </td>
                        );
                      })}
                      <td className="border px-2 text-center">{past.length ? `${Math.round((signed / past.length) * 100)} %` : "—"}</td>
                    </tr>
                  );
                })}
                <tr>
                                    <td className="sticky left-0 border bg-slate-50 px-2 py-1 font-medium">Formateur</td>
                  {s.slots.map((sl) => (
                    <td key={sl.id} className="h-12 border px-1 text-center">
                      {sl.trainerSignature && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sl.trainerSignature} alt="Signature formateur" title={`${sl.trainerName} · ${formatDate(sl.trainerSignedAt, true)}`} className="paper-sign mx-auto h-9" />
                      )}
                    </td>
                  ))}
                  <td className="border" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {s.enrollments.length === 0 && <p className="mt-2 text-sm text-slate-500">Aucun inscrit sur cette session.</p>}
        <p className="no-print mt-2 text-xs text-slate-400">
          Les signatures sont horodatées avec l&apos;adresse IP. <Badge>Absent</Badge> = créneau passé non signé.
        </p>
      </section>
    </Container>
  );
}
