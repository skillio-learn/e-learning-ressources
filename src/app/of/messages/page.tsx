import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { manageableCoursesWhere } from "@/lib/permissions";
import { Badge, Container, Empty, PageHeader, Stat } from "@/components/ui";
import { formatDuration } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Messagerie pédagogique" };
export const dynamic = "force-dynamic";

/** Délai moyen de réponse de l'équipe (preuve de l'assistance pédagogique FOAD). */
function responseDelays(messages: { fromStaff: boolean; createdAt: Date; enrollmentId: string }[]) {
  const delays: number[] = [];
  const pending = new Map<string, Date>();
  for (const m of messages) {
    if (!m.fromStaff) {
      if (!pending.has(m.enrollmentId)) pending.set(m.enrollmentId, m.createdAt);
    } else if (pending.has(m.enrollmentId)) {
      delays.push((m.createdAt.getTime() - pending.get(m.enrollmentId)!.getTime()) / 1000);
      pending.delete(m.enrollmentId);
    }
  }
  return { delays, waiting: pending };
}

export default async function OfMessages() {
  const user = await requireStaff();
  const courseIds = (await db.course.findMany({ where: manageableCoursesWhere(user), select: { id: true } })).map((c) => c.id);
  const messages = await db.pedagogicalMessage.findMany({
    where: { enrollment: { courseId: { in: courseIds } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, fromStaff: true, createdAt: true, enrollmentId: true, body: true, readAt: true },
  });
  const { delays, waiting } = responseDelays(messages);
  const avg = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null;
  const byEnrollment = new Map<string, typeof messages>();
  messages.forEach((m) => byEnrollment.set(m.enrollmentId, [...(byEnrollment.get(m.enrollmentId) ?? []), m]));
  const enrollments = await db.enrollment.findMany({
    where: { id: { in: [...byEnrollment.keys()] } },
    include: { user: { select: { name: true } }, course: { select: { title: true } } },
  });
  const threads = enrollments
    .map((e) => {
      const list = byEnrollment.get(e.id)!;
      return { e, last: list[list.length - 1], unread: list.filter((m) => !m.fromStaff && !m.readAt).length, waitingSince: waiting.get(e.id) ?? null };
    })
    .sort((a, b) => Number(!!b.waitingSince) - Number(!!a.waitingSince) || b.last.createdAt.getTime() - a.last.createdAt.getTime());
  return (
    <Container>
      <PageHeader title="Messagerie pédagogique" subtitle="Assistance pédagogique et technique aux apprenants (art. D.6313-3-1 du Code du travail) : échanges horodatés et délais de réponse tracés." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="En attente de réponse" value={waiting.size} />
        <Stat label="Délai moyen de réponse" value={avg === null ? "—" : formatDuration(avg)} hint={`${delays.length} réponse(s)`} />
        <Stat label="Messages échangés" value={messages.length} />
      </div>
      {threads.length === 0 ? (
        <Empty title="Aucun échange pour le moment" />
      ) : (
        <div className="card divide-y divide-slate-100">
          {threads.map(({ e, last, unread, waitingSince }) => (
            <Link key={e.id} href={`/of/messages/${e.id}`} className="flex items-center gap-4 p-4 hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{e.user.name} <span className="text-xs font-normal text-slate-500">· {e.course.title}</span></div>
                <div className="truncate text-sm text-slate-500">{last.fromStaff ? "Vous : " : ""}{last.body}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-500">
                {formatDate(last.createdAt, true)}
                {waitingSince && <Badge tone="amber">En attente depuis {formatDuration((Date.now() - waitingSince.getTime()) / 1000)}</Badge>}
                {unread > 0 && <Badge tone="red">{unread} non lu(s)</Badge>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
