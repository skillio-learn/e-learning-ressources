import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Date du créneau (jour) + heure « HH:MM » en heure de Paris. */
function local(day: Date, hm: string) {
  const [h, m] = hm.split(":").map((x) => x.padStart(2, "0"));
  return `${day.toISOString().slice(0, 10).replace(/-/g, "")}T${h}${m ?? "00"}00`;
}
/** Plie les lignes à 75 octets (RFC 5545). */
const fold = (line: string) => line.match(/.{1,73}/g)!.join("\r\n ");

/** Flux ICS personnel (Google Agenda, Outlook, Apple Calendrier) : créneaux de formation et échéances de tâches. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, "");
  if (token.length < 20) return new Response("Introuvable", { status: 404 });
  const user = await db.user.findUnique({ where: { calendarToken: token }, select: { id: true, role: true, active: true, organizationId: true } });
  if (!user?.active) return new Response("Introuvable", { status: 404 });
  const since = new Date(Date.now() - 60 * 86400_000);
  const sessionWhere =
    user.role === "LEARNER"
      ? { enrollments: { some: { userId: user.id, status: { not: "SUSPENDED" as const } } } }
      : user.role === "TRAINER"
        ? { OR: [{ trainerId: user.id }, { course: { trainers: { some: { userId: user.id } } } }] }
        : user.role === "OF_ADMIN"
          ? { course: { organizationId: user.organizationId ?? "__" } }
          : { id: "__" };
  const [slots, tasks] = await Promise.all([
    db.attendanceSlot.findMany({
      where: { date: { gte: since }, session: sessionWhere },
      orderBy: { date: "asc" },
      take: 1000,
      include: { session: { select: { id: true, name: true, address: true, city: true, location: true, room: true, course: { select: { title: true } } } } },
    }),
    user.role === "OF_ADMIN" || user.role === "TRAINER"
      ? db.task.findMany({ where: { assigneeId: user.id, status: "OPEN", dueAt: { not: null } }, take: 300 })
      : Promise.resolve([]),
  ]);
  const now = stamp(new Date());
  const link = (sessionId: string) => (user.role === "LEARNER" ? appUrl("/attendance") : appUrl(`/of/sessions/${sessionId}`));
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Vylia//Agenda//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Vylia", "X-WR-TIMEZONE:Europe/Paris",
    ...slots.flatMap((s) => {
      const place = [s.session.room && `Salle ${s.session.room}`, s.session.address, s.session.city].filter(Boolean).join(", ") || s.session.location || "";
      return [
        "BEGIN:VEVENT", `UID:slot-${s.id}@vylia`, `DTSTAMP:${now}`,
        `DTSTART;TZID=Europe/Paris:${local(s.date, s.startTime)}`, `DTEND;TZID=Europe/Paris:${local(s.date, s.endTime)}`,
        fold(`SUMMARY:${esc(`${s.session.course.title} · ${s.label}`)}`),
        ...(place ? [fold(`LOCATION:${esc(place)}`)] : []),
        fold(`DESCRIPTION:${esc(`${s.session.name}. Émargement : ${link(s.session.id)}`)}`),
        fold(`URL:${link(s.session.id)}`),
        "END:VEVENT",
      ];
    }),
    ...tasks.flatMap((t) => [
      "BEGIN:VEVENT", `UID:task-${t.id}@vylia`, `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${t.dueAt!.toISOString().slice(0, 10).replace(/-/g, "")}`,
      fold(`SUMMARY:${esc(`Tâche : ${t.title}`)}`), fold(`URL:${appUrl("/of/tasks")}`), "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="vylia.ics"', "Cache-Control": "private, max-age=900" },
  });
}
