import "server-only";
import { db } from "./db";
import { getCourseOutline, getLearnerResults } from "./progress";

export type DayLine = {
  day: string; // YYYY-MM-DD
  firstAt: Date;
  lastAt: Date;
  seconds: number;
  lessons: string[];
};

/** Données de traçabilité d'une inscription : temps par jour, par leçon, connexions, résultats. */
export async function enrollmentTrace(enrollmentId: string) {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      user: { select: { id: true, name: true, email: true, profile: true } },
      course: {
        select: {
          id: true, title: true, durationHours: true, modality: true, rncpCode: true,
          organization: true,
        },
      },
      session: true,
      application: { select: { number: true } },
    },
  });
  if (!enrollment) return null;
  const { userId, courseId } = enrollment;

  const [logs, outline, results, logins, sessions, progress, signatures] = await Promise.all([
    db.timeLog.findMany({
      where: { userId, courseId },
      orderBy: { startedAt: "asc" },
      include: { lesson: { select: { id: true, title: true } } },
    }),
    getCourseOutline(courseId, userId, { ignoreLocks: true }),
    getLearnerResults(userId, courseId),
    db.loginEvent.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.activitySession.findMany({ where: { userId }, orderBy: { startedAt: "asc" } }),
    db.lessonProgress.findMany({ where: { userId, lesson: { module: { courseId } } } }),
    enrollment.sessionId
      ? db.attendanceSignature.findMany({
          where: { userId, slot: { sessionId: enrollment.sessionId } },
          include: { slot: true },
          orderBy: { signedAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const byDay = new Map<string, DayLine>();
  for (const l of logs) {
    const day = l.startedAt.toISOString().slice(0, 10);
    const cur = byDay.get(day) ?? { day, firstAt: l.startedAt, lastAt: l.endedAt, seconds: 0, lessons: [] };
    cur.seconds += l.seconds;
    if (l.startedAt < cur.firstAt) cur.firstAt = l.startedAt;
    if (l.endedAt > cur.lastAt) cur.lastAt = l.endedAt;
    if (!cur.lessons.includes(l.lesson.title)) cur.lessons.push(l.lesson.title);
    byDay.set(day, cur);
  }
  const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));

  const byLesson = new Map<string, { title: string; seconds: number; segments: number; first: Date; last: Date }>();
  for (const l of logs) {
    const cur = byLesson.get(l.lessonId) ?? { title: l.lesson.title, seconds: 0, segments: 0, first: l.startedAt, last: l.endedAt };
    cur.seconds += l.seconds;
    cur.segments += 1;
    if (l.endedAt > cur.last) cur.last = l.endedAt;
    byLesson.set(l.lessonId, cur);
  }
  const progressByLesson = new Map(progress.map((p) => [p.lessonId, p]));
  const lessons = (outline?.flat ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    type: l.type,
    completed: l.completed,
    completedAt: progressByLesson.get(l.id)?.completedAt ?? null,
    seconds: byLesson.get(l.id)?.seconds ?? 0,
    segments: byLesson.get(l.id)?.segments ?? 0,
    score: progressByLesson.get(l.id)?.score ?? null,
  }));

  const totalSeconds = logs.reduce((s, l) => s + l.seconds, 0);
  const periodStart = enrollment.startDate ?? enrollment.enrolledAt;
  const periodEnd = enrollment.completedAt ?? enrollment.endDate ?? new Date();
  const loginsInPeriod = logins.filter((e) => e.createdAt >= new Date(periodStart.getTime() - 86400000));
  const sessionsInPeriod = sessions.filter((s) => s.startedAt >= new Date(periodStart.getTime() - 86400000));

  return {
    enrollment,
    days,
    lessons,
    totalSeconds,
    firstActivity: logs[0]?.startedAt ?? null,
    lastActivity: logs.at(-1)?.endedAt ?? null,
    percent: outline?.percent ?? 0,
    completedSteps: outline?.completed ?? 0,
    totalSteps: outline?.total ?? 0,
    results,
    logins: loginsInPeriod,
    sessions: sessionsInPeriod,
    signatures,
    periodStart,
    periodEnd,
  };
}

/** Synthèse par apprenant pour un ensemble de formations (rapports OF). */
export async function learnersSummary(courseIds: string[], from?: Date | null, to?: Date | null) {
  const enrollments = await db.enrollment.findMany({
    where: { courseId: { in: courseIds } },
    include: {
      user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
      course: { select: { id: true, title: true } },
    },
    orderBy: [{ course: { title: "asc" } }, { user: { name: "asc" } }],
  });
  const timeWhere = {
    courseId: { in: courseIds },
    ...(from || to ? { startedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
  const [times, logins] = await Promise.all([
    db.timeLog.groupBy({ by: ["userId", "courseId"], where: timeWhere, _sum: { seconds: true }, _max: { endedAt: true }, _count: true }),
    db.loginEvent.groupBy({
      by: ["userId"],
      where: {
        type: "LOGIN",
        userId: { in: enrollments.map((e) => e.userId) },
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      _count: true,
    }),
  ]);
  const timeMap = new Map(times.map((t) => [`${t.userId}:${t.courseId}`, t]));
  const loginMap = new Map(logins.map((l) => [l.userId!, l._count]));
  return Promise.all(
    enrollments.map(async (e) => {
      const outline = await getCourseOutline(e.courseId, e.userId, { ignoreLocks: true });
      const t = timeMap.get(`${e.userId}:${e.courseId}`);
      return {
        enrollment: e,
        seconds: t?._sum.seconds ?? 0,
        lastActivity: t?._max.endedAt ?? null,
        segments: t?._count ?? 0,
        logins: loginMap.get(e.userId) ?? 0,
        percent: outline?.percent ?? 0,
      };
    }),
  );
}

export function dateParam(v: string | undefined | null, endOfDay = false) {
  if (!v) return null;
  const d = new Date(v + (endOfDay ? "T23:59:59" : "T00:00:00"));
  return Number.isNaN(d.getTime()) ? null : d;
}
