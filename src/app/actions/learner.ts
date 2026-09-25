"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/uploads";
import { requireActiveLearnerAccount, requireUser } from "@/lib/auth";
import { notifyCourseGraders, notifyOrgManagers } from "@/lib/notify";
import { courseIdForLesson } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { initialAccessStatus, learnerCanAccess } from "@/lib/onboarding";
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
  if (!learnerCanAccess(user.accountStatus, enrollment)) throw new Error("Votre accès à cette formation n'est pas encore ouvert par l'organisme");
  const outline = await getCourseOutline(lesson.module.courseId, user.id);
  const entry = outline?.flat.find((l) => l.id === lessonId);
  if (!entry || entry.locked) throw new Error("Cette étape est verrouillée : terminez d'abord les étapes précédentes");
  return { user, lesson, slug: lesson.module.course.slug };
}

/** Demande d'inscription directe à une formation « ouverte » : l'OF valide les documents puis ouvre l'accès. */
export async function enrollAction(courseId: string) {
  const user = await requireActiveLearnerAccount();
  const course = await db.course.findUnique({ where: { id: courseId }, include: { organization: { select: { enrollmentRequiredDocuments: true } } } });
  if (!course || course.status !== "PUBLISHED" || course.enrollmentPolicy !== "OPEN" || course.organizationId !== user.organizationId) {
    throw new Error("Inscription impossible à cette formation");
  }
  const existing = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } });
  if (existing) redirect(`/enrollments/${existing.id}`);
  const e = await db.enrollment.create({
    data: { userId: user.id, courseId, origin: "SELF", accessStatus: initialAccessStatus(course.organization, "SELF"), startDate: new Date() },
  });
  await audit("enrollment.create", { actorId: user.id, organizationId: course.organizationId, entityType: "Enrollment", entityId: e.id, details: "demande de l'apprenant" });
  await notifyOrgManagers(course.organizationId, `Demande d'inscription – ${user.name}`, `${user.name} demande à suivre « ${course.title} ».`, `/of/access/${e.id}`);
  redirect(`/enrollments/${e.id}`);
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
  // Score remonté par le navigateur : accepté uniquement pour un module interactif, et enregistré une seule fois
  let s: number | null = null;
  if (lesson.type === "INTERACTIVE" && typeof score === "number" && Number.isFinite(score)) {
    const prev = await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId } }, select: { score: true, status: true } });
    if (!(prev?.status === "COMPLETED" && prev.score !== null)) s = Math.round(Math.max(0, Math.min(100, score)));
  }
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
    const created = await db.quizAttempt.create({ data: { quizId, userId: user.id } });
    // Requêtes simultanées : on ne garde qu'une tentative en cours et on respecte le nombre maximal
    const [open, total] = await Promise.all([
      db.quizAttempt.findMany({ where: { quizId, userId: user.id, status: "IN_PROGRESS" }, orderBy: { startedAt: "asc" }, select: { id: true } }),
      db.quizAttempt.count({ where: { quizId, userId: user.id } }),
    ]);
    if (open.length > 1 && open[0].id !== created.id) await db.quizAttempt.delete({ where: { id: created.id } });
    else if (quiz.maxAttempts && total > quiz.maxAttempts) {
      await db.quizAttempt.delete({ where: { id: created.id } });
      throw new Error("Nombre maximal de tentatives atteint");
    }
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

  // Remise unique (double clic, requêtes simultanées)
  const claimed = await db.quizAttempt.updateMany({ where: { id: attemptId, status: "IN_PROGRESS", submittedAt: null }, data: { submittedAt: new Date() } });
  if (claimed.count !== 1) throw new Error("Cette tentative a déjà été remise");

  // Temps limite (1 minute de marge réseau) : une remise hors délai est enregistrée mais n'est pas notée
  const late = !!attempt.quiz.timeLimitMin && Date.now() > attempt.startedAt.getTime() + (attempt.quiz.timeLimitMin + 1) * 60_000;
  if (late) await db.quizAttempt.update({ where: { id: attemptId }, data: { feedback: "Remis après la limite de temps : tentative non notée." } });

  for (const q of attempt.quiz.questions) {
    const selected = [...new Set(fd.getAll(`q_${q.id}`).map(String))].slice(0, 50);
    const text = typeof fd.get(`t_${q.id}`) === "string" ? String(fd.get(`t_${q.id}`)).slice(0, 20000) : null;
    const raw = { selectedOptionIds: selected, text };
    const g = late ? { pointsAwarded: 0, isCorrect: false, needsReview: false } : gradeAnswer(q, raw);
    await db.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: q.id } },
      create: { attemptId, questionId: q.id, ...raw, ...g },
      update: { ...raw, ...g },
    });
  }
  const graded = await recomputeAttempt(attemptId);
  if (graded?.status === "PENDING_REVIEW") {
    const courseId = await courseIdForLesson(attempt.quiz.lesson.id);
    await notifyCourseGraders(courseId, `Quiz à corriger – ${user.name}`, "Des questions ouvertes attendent votre correction.", `/of/grading/attempts/${attemptId}`);
  }
  revalidatePath(`/learn/${slug}`, "layout");
  redirect(`/learn/${slug}/${attempt.quiz.lesson.id}?attempt=${attemptId}`);
}

// ─────────────── Devoirs ───────────────

export type AssignmentState = { error?: string; ok?: string } | undefined;

/**
 * Remise d'un devoir : texte, lien (vidéo hébergée, document en ligne) et/ou fichier (PDF, photo d'un exercice papier,
 * document, courte vidéo). Le devoir remis apparaît chez les formateurs de la formation et les responsables de l'OF.
 */
export async function submitAssignmentAction(lessonId: string, _: AssignmentState, fd: FormData): Promise<AssignmentState> {
  const { user, lesson, slug } = await loadLessonForLearner(lessonId);
  if (lesson.type !== "ASSIGNMENT") return { error: "Cette étape n'est pas un devoir." };

  const existing = await db.submission.findFirst({ where: { lessonId, userId: user.id }, orderBy: { submittedAt: "desc" } });
  if (existing && existing.status === "GRADED") return { error: "Ce devoir a déjà été évalué." };

  const text = String(fd.get("text") ?? "").trim().slice(0, 50000) || null;
  const rawLink = String(fd.get("linkUrl") ?? "").trim();
  const linkUrl = safeUrl(rawLink);
  if (rawLink && !linkUrl) return { error: "Lien invalide (adresse commençant par https://)." };
  const up = await readUpload(fd, { kind: "assignment", required: false });
  if ("error" in up) return up;
  if (!text && !linkUrl && !up.file && !existing?.fileName) return { error: "Ajoutez une réponse écrite, un lien ou un fichier." };

  const data = {
    text,
    linkUrl,
    ...(up.file ? { fileName: up.file.fileName, fileType: up.file.fileType, fileData: up.file.data } : {}),
    status: "SUBMITTED" as const,
    submittedAt: new Date(),
  };
  const sub = existing
    ? await db.submission.update({ where: { id: existing.id }, data })
    : await db.submission.create({ data: { lessonId, userId: user.id, ...data } });

  // La remise débloque l'étape suivante ; la validation finale dépend de l'évaluation par le formateur.
  await completeLesson(user.id, lessonId);
  const courseId = await courseIdForLesson(lessonId);
  await notifyCourseGraders(courseId, `Devoir à corriger – ${user.name}`, `« ${lesson.title} »${existing ? " (nouvelle version)" : ""}`, `/of/grading/submissions/${sub.id}`);
  revalidatePath(`/learn/${slug}`, "layout");
  return { ok: existing ? "Votre rendu a été mis à jour : le formateur est prévenu." : "Devoir remis : le formateur est prévenu." };
}
