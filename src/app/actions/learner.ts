"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { completeLesson, getCourseOutline } from "@/lib/progress";
import { gradeAnswer, recomputeAttempt } from "@/lib/quiz";
import { safeUrl } from "@/lib/utils";

async function loadLessonForLearner(lessonId: string) {
  const user = await requireUser();
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true, course: { select: { slug: true } } } } },
  });
  if (!lesson || !lesson.published) throw new Error("Leçon introuvable");
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: lesson.module.courseId } },
  });
  if (!enrollment || enrollment.status === "SUSPENDED") throw new Error("Vous n'êtes pas inscrit à cette formation");
  const outline = await getCourseOutline(lesson.module.courseId, user.id);
  const entry = outline?.flat.find((l) => l.id === lessonId);
  if (!entry || entry.locked) throw new Error("Cette étape est verrouillée : terminez d'abord les étapes précédentes");
  return { user, lesson, slug: lesson.module.course.slug };
}

export async function enrollAction(courseId: string) {
  const user = await requireUser();
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || course.status !== "PUBLISHED" || course.enrollmentPolicy !== "OPEN") {
    throw new Error("Inscription impossible à cette formation");
  }
  await db.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId } },
    create: { userId: user.id, courseId },
    update: {},
  });
  redirect(`/learn/${course.slug}`);
}

export async function completeLessonAction(lessonId: string, score?: number | null) {
  const { user, lesson, slug } = await loadLessonForLearner(lessonId);
  if (lesson.type === "QUIZ" || lesson.type === "ASSIGNMENT") {
    throw new Error("Cette étape se valide en répondant au quiz / en remettant le devoir");
  }
  if (lesson.minTimeSec) {
    const p = await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId } }, select: { timeSpentSec: true } });
    // Tolérance de 45 s (battement d'activité en cours d'envoi)
    if ((p?.timeSpentSec ?? 0) + 45 < lesson.minTimeSec) {
      throw new Error("Le temps minimum de consultation de cette étape n'est pas encore atteint.");
    }
  }
  const s = typeof score === "number" && Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
  await completeLesson(user.id, lessonId, s);
  revalidatePath(`/learn/${slug}`, "layout");
  return { ok: true };
}

// ─────────────── Quiz ───────────────

export async function startQuizAttemptAction(quizId: string) {
  const quiz = await db.quiz.findUnique({ where: { id: quizId }, select: { lessonId: true, maxAttempts: true } });
  if (!quiz) throw new Error("Quiz introuvable");
  const { user, slug } = await loadLessonForLearner(quiz.lessonId);

  const inProgress = await db.quizAttempt.findFirst({ where: { quizId, userId: user.id, status: "IN_PROGRESS" } });
  if (!inProgress) {
    const used = await db.quizAttempt.count({ where: { quizId, userId: user.id } });
    if (quiz.maxAttempts && used >= quiz.maxAttempts) throw new Error("Nombre maximal de tentatives atteint");
    await db.quizAttempt.create({ data: { quizId, userId: user.id } });
  }
  revalidatePath(`/learn/${slug}/${quiz.lessonId}`);
}

export async function submitQuizAttemptAction(attemptId: string, fd: FormData) {
  const user = await requireUser();
  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: { quiz: { include: { questions: { include: { options: true } }, lesson: { select: { id: true } } } } },
  });
  if (!attempt || attempt.userId !== user.id) throw new Error("Tentative introuvable");
  if (attempt.status !== "IN_PROGRESS") throw new Error("Cette tentative a déjà été remise");
  const { slug } = await loadLessonForLearner(attempt.quiz.lesson.id);

  // Temps limite : on tolère 1 minute de marge réseau
  if (attempt.quiz.timeLimitMin) {
    const deadline = attempt.startedAt.getTime() + (attempt.quiz.timeLimitMin + 1) * 60_000;
    if (Date.now() > deadline) {
      // Les réponses sont tout de même enregistrées ; la remise tardive est signalée dans le feedback.
      await db.quizAttempt.update({ where: { id: attemptId }, data: { feedback: "Remis après la limite de temps." } });
    }
  }

  for (const q of attempt.quiz.questions) {
    const selected = fd.getAll(`q_${q.id}`).map(String);
    const text = typeof fd.get(`t_${q.id}`) === "string" ? String(fd.get(`t_${q.id}`)).slice(0, 20000) : null;
    const raw = { selectedOptionIds: selected, text };
    const g = gradeAnswer(q, raw);
    await db.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: q.id } },
      create: { attemptId, questionId: q.id, ...raw, ...g },
      update: { ...raw, ...g },
    });
  }
  await db.quizAttempt.update({ where: { id: attemptId }, data: { submittedAt: new Date() } });
  await recomputeAttempt(attemptId);
  revalidatePath(`/learn/${slug}`, "layout");
  redirect(`/learn/${slug}/${attempt.quiz.lesson.id}?attempt=${attemptId}`);
}

// ─────────────── Devoirs ───────────────

const MAX_FILE = 8 * 1024 * 1024;

export async function submitAssignmentAction(lessonId: string, fd: FormData) {
  const { user, lesson, slug } = await loadLessonForLearner(lessonId);
  if (lesson.type !== "ASSIGNMENT") throw new Error("Cette leçon n'est pas un devoir");

  const existing = await db.submission.findFirst({
    where: { lessonId, userId: user.id },
    orderBy: { submittedAt: "desc" },
  });
  if (existing && existing.status === "GRADED") throw new Error("Ce devoir a déjà été évalué");

  const text = String(fd.get("text") ?? "").trim() || null;
  const linkUrl = safeUrl(String(fd.get("linkUrl") ?? "").trim());
  const file = fd.get("file");
  let fileData: { fileName: string; fileType: string; fileData: Uint8Array<ArrayBuffer> } | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE) throw new Error("Fichier trop volumineux (8 Mo maximum)");
    fileData = { fileName: file.name, fileType: file.type || "application/octet-stream", fileData: new Uint8Array(await file.arrayBuffer()) };
  }
  if (!text && !linkUrl && !fileData && !existing?.fileName) throw new Error("Ajoutez un texte, un lien ou un fichier");

  const data = { text, linkUrl, ...(fileData ?? {}), status: "SUBMITTED" as const, submittedAt: new Date() };
  if (existing) await db.submission.update({ where: { id: existing.id }, data });
  else await db.submission.create({ data: { lessonId, userId: user.id, ...data } });

  // La remise débloque l'étape suivante ; la validation finale dépend de l'évaluation par le formateur.
  await completeLesson(user.id, lessonId);
  revalidatePath(`/learn/${slug}`, "layout");
}
