import "server-only";
import type { LessonType } from "@prisma/client";
import { db } from "./db";
import { randomCode, round2 } from "./utils";

export type OutlineLesson = {
  id: string;
  title: string;
  type: LessonType;
  position: number;
  durationMin: number | null;
  required: boolean;
  completed: boolean;
  locked: boolean;
  index: number; // numéro global de l'étape (1..n)
};

export type OutlineModule = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: OutlineLesson[];
  completedCount: number;
};

/**
 * Plan de la formation pour un apprenant, avec état terminé / verrouillé.
 * En mode séquentiel, une leçon est verrouillée tant qu'une leçon obligatoire précédente n'est pas terminée.
 */
export async function getCourseOutline(courseId: string, userId: string | null, opts?: { ignoreLocks?: boolean }) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      sequential: true,
      modules: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          position: true,
          lessons: {
            where: { published: true },
            orderBy: { position: "asc" },
            select: { id: true, title: true, type: true, position: true, durationMin: true, required: true },
          },
        },
      },
    },
  });
  if (!course) return null;

  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const done = new Set<string>();
  if (userId && lessonIds.length) {
    const rows = await db.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds }, status: "COMPLETED" },
      select: { lessonId: true },
    });
    rows.forEach((r) => done.add(r.lessonId));
  }

  let blocked = false;
  let index = 0;
  const modules: OutlineModule[] = course.modules.map((m) => {
    const lessons = m.lessons.map((l) => {
      index += 1;
      const completed = done.has(l.id);
      const locked = !opts?.ignoreLocks && course.sequential && blocked;
      if (l.required && !completed) blocked = true;
      return { ...l, completed, locked, index };
    });
    return { ...m, lessons, completedCount: lessons.filter((l) => l.completed).length };
  });

  const flat = modules.flatMap((m) => m.lessons);
  const required = flat.filter((l) => l.required);
  const completedRequired = required.filter((l) => l.completed).length;
  const percent = required.length ? Math.round((completedRequired / required.length) * 100) : 0;
  const next = flat.find((l) => !l.completed && !l.locked) ?? null;

  return { modules, flat, percent, total: flat.length, completed: flat.filter((l) => l.completed).length, next };
}

export async function markLessonStarted(userId: string, lessonId: string) {
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId },
    update: {},
  });
}

export async function completeLesson(userId: string, lessonId: string, score?: number | null) {
  const now = new Date();
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, status: "COMPLETED", completedAt: now, score: score ?? null },
    update: {
      status: "COMPLETED",
      completedAt: now,
      ...(score !== undefined && score !== null ? { score } : {}),
    },
  });
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { module: { select: { courseId: true } } } });
  if (lesson) {
    await db.enrollment.updateMany({
      where: { userId, courseId: lesson.module.courseId },
      data: { lastActivityAt: now },
    });
    await evaluateCourseCompletion(userId, lesson.module.courseId);
  }
}

/**
 * Synthèse des résultats d'un apprenant sur une formation :
 * meilleurs scores aux quiz notés, notes des devoirs, moyenne et validation.
 */
export async function getLearnerResults(userId: string, courseId: string) {
  const lessons = await db.lesson.findMany({
    where: { published: true, module: { courseId }, type: { in: ["QUIZ", "ASSIGNMENT"] } },
    orderBy: [{ module: { position: "asc" } }, { position: "asc" }],
    select: {
      id: true,
      title: true,
      type: true,
      required: true,
      quiz: { select: { id: true, graded: true, passingScore: true } },
      rubric: { select: { passingScore: true } },
    },
  });

  const results = await Promise.all(
    lessons.map(async (l) => {
      if (l.type === "QUIZ" && l.quiz) {
        const attempts = await db.quizAttempt.findMany({
          where: { quizId: l.quiz.id, userId, status: { not: "IN_PROGRESS" } },
          orderBy: { percent: "desc" },
          select: { id: true, percent: true, passed: true, status: true },
        });
        const best = attempts[0];
        return {
          lessonId: l.id,
          title: l.title,
          kind: "QUIZ" as const,
          counted: l.quiz.graded,
          percent: best?.percent ?? null,
          passed: best?.passed ?? false,
          pending: attempts.some((a) => a.status === "PENDING_REVIEW"),
          attempts: attempts.length,
          refId: best?.id ?? null,
        };
      }
      const sub = await db.submission.findFirst({
        where: { lessonId: l.id, userId },
        orderBy: { submittedAt: "desc" },
        select: { id: true, percent: true, passed: true, status: true },
      });
      return {
        lessonId: l.id,
        title: l.title,
        kind: "ASSIGNMENT" as const,
        counted: true,
        percent: sub?.percent ?? null,
        passed: sub?.passed ?? false,
        pending: sub?.status === "SUBMITTED",
        attempts: sub ? 1 : 0,
        refId: sub?.id ?? null,
      };
    }),
  );

  const counted = results.filter((r) => r.counted && r.percent !== null);
  const average = counted.length ? round2(counted.reduce((s, r) => s + (r.percent ?? 0), 0) / counted.length) : null;
  return { results, average };
}

/** Vérifie si la formation est terminée et validée ; délivre le certificat si c'est le cas. */
export async function evaluateCourseCompletion(userId: string, courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { passingScore: true, certificateEnabled: true },
  });
  if (!course) return false;
  const outline = await getCourseOutline(courseId, userId, { ignoreLocks: true });
  if (!outline || outline.total === 0) return false;
  const allRequiredDone = outline.flat.filter((l) => l.required).every((l) => l.completed);
  if (!allRequiredDone) return false;

  const { results, average } = await getLearnerResults(userId, courseId);
  const evaluationsOk = results.filter((r) => r.counted).every((r) => r.passed && !r.pending);
  const scoreOk = average === null || average >= course.passingScore;
  if (!evaluationsOk || !scoreOk) return false;

  const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (enrollment && enrollment.status !== "COMPLETED") {
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }
  if (course.certificateEnabled) {
    await db.certificate.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, code: randomCode(12), finalScore: average },
      update: { finalScore: average },
    });
  }
  return true;
}
