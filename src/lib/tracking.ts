import "server-only";
import { db } from "./db";

export const HEARTBEAT_SEC = 30;
const MAX_BEAT_SEC = HEARTBEAT_SEC * 2 + 10;
const DEFAULT_TIMEOUT_MIN = 15;

/** Délais d'inactivité (minutes) : standard et dans un module interactif. */
export async function timeoutsFor(userId: string) {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { organization: { select: { inactivityTimeoutMin: true, interactiveTimeoutMin: true } } },
  });
  return {
    standard: u?.organization?.inactivityTimeoutMin ?? DEFAULT_TIMEOUT_MIN,
    interactive: u?.organization?.interactiveTimeoutMin ?? 45,
  };
}

export async function inactivityTimeoutFor(userId: string) {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { organization: { select: { inactivityTimeoutMin: true } } },
  });
  return u?.organization?.inactivityTimeoutMin ?? DEFAULT_TIMEOUT_MIN;
}

/** Ouvre une nouvelle session de connexion (appelé à la connexion). */
export async function startActivitySession(userId: string, ip: string | null, userAgent: string | null) {
  await closeOpenSessions(userId);
  return db.activitySession.create({ data: { userId, ip, userAgent } });
}

export async function closeOpenSessions(userId: string) {
  const open = await db.activitySession.findMany({ where: { userId, endedAt: null }, select: { id: true, lastSeenAt: true } });
  await Promise.all(open.map((s) => db.activitySession.update({ where: { id: s.id }, data: { endedAt: s.lastSeenAt } })));
}

/**
 * Enregistre un battement d'activité : `seconds` = temps actif (onglet visible, interaction récente)
 * écoulé depuis le battement précédent.
 */
export async function recordHeartbeat(
  userId: string,
  input: { lessonId?: string | null; seconds: number; ip: string | null; userAgent: string | null },
) {
  const claimed = Math.max(0, Math.min(MAX_BEAT_SEC, Math.round(Number.isFinite(input.seconds) ? input.seconds : 0)));
  const now = new Date();
  const t = await timeoutsFor(userId);
  const timeoutMs = Math.max(t.standard, t.interactive) * 60_000;

  // 1. Session de connexion. Le temps crédité ne peut jamais dépasser le temps réellement écoulé depuis le
  //    battement précédent (anti-falsification : rafales de requêtes, horloge du navigateur modifiée…).
  let seconds = 0;
  let session = await db.activitySession.findFirst({ where: { userId, endedAt: null }, orderBy: { lastSeenAt: "desc" } });
  if (session && now.getTime() - session.lastSeenAt.getTime() > timeoutMs + MAX_BEAT_SEC * 1000) {
    await db.activitySession.update({ where: { id: session.id }, data: { endedAt: session.lastSeenAt } });
    session = null;
  }
  if (session) {
    const elapsed = Math.max(0, Math.floor((now.getTime() - session.lastSeenAt.getTime()) / 1000) + 2);
    seconds = Math.min(claimed, elapsed);
    // Mise à jour conditionnelle : si un autre battement a été compté entre-temps, celui-ci ne crédite rien
    const updated = await db.activitySession.updateMany({
      where: { id: session.id, lastSeenAt: session.lastSeenAt },
      data: { lastSeenAt: now, activeSeconds: { increment: seconds } },
    });
    if (updated.count === 0) seconds = 0;
    session = await db.activitySession.findUniqueOrThrow({ where: { id: session.id } });
  } else {
    seconds = Math.min(claimed, HEARTBEAT_SEC);
    session = await db.activitySession.create({
      data: { userId, startedAt: new Date(now.getTime() - seconds * 1000), lastSeenAt: now, activeSeconds: seconds, ip: input.ip, userAgent: input.userAgent },
    });
  }

  // 2. Temps passé sur la leçon : uniquement sur une leçon publiée d'une formation dont l'accès est ouvert
  let lessonSeconds: number | null = null;
  if (input.lessonId) {
    const lesson = await db.lesson.findUnique({ where: { id: input.lessonId }, select: { id: true, published: true, module: { select: { courseId: true } } } });
    if (lesson?.published) {
      const courseId = lesson.module.courseId;
      const [enrolled, u] = await Promise.all([
        db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { id: true, status: true, accessStatus: true } }),
        db.user.findUnique({ where: { id: userId }, select: { accountStatus: true } }),
      ]);
      if (enrolled && enrolled.status !== "SUSPENDED" && enrolled.accessStatus === "GRANTED" && u?.accountStatus === "ACTIVE") {
        if (seconds > 0) {
          const recent = await db.timeLog.findFirst({
            where: { userId, lessonId: lesson.id, endedAt: { gte: new Date(now.getTime() - MAX_BEAT_SEC * 1000 - 5000) } },
            orderBy: { endedAt: "desc" },
          });
          if (recent) {
            await db.timeLog.update({ where: { id: recent.id }, data: { endedAt: now, seconds: { increment: seconds } } });
          } else {
            await db.timeLog.create({
              data: {
                userId,
                lessonId: lesson.id,
                courseId,
                activitySessionId: session.id,
                startedAt: new Date(now.getTime() - seconds * 1000),
                endedAt: now,
                seconds,
              },
            });
          }
          await db.enrollment.update({ where: { id: enrolled.id }, data: { lastActivityAt: now } });
        }
        const progress = await db.lessonProgress.upsert({
          where: { userId_lessonId: { userId, lessonId: lesson.id } },
          create: { userId, lessonId: lesson.id, timeSpentSec: seconds },
          update: { timeSpentSec: { increment: seconds } },
        });
        lessonSeconds = progress.timeSpentSec;
      }
    }
  }
  return { sessionSeconds: session.activeSeconds, lessonSeconds };
}

/** Temps actif total d'un apprenant sur une formation (secondes). */
export async function courseTimeSeconds(userId: string, courseId: string) {
  const r = await db.timeLog.aggregate({ where: { userId, courseId }, _sum: { seconds: true } });
  return r._sum.seconds ?? 0;
}
