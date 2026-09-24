import "server-only";
import type { Question, QuestionOption } from "@prisma/client";
import { db } from "./db";
import { normalizeText, round2 } from "./utils";
import { completeLesson, evaluateCourseCompletion } from "./progress";

type Q = Question & { options: QuestionOption[] };
export type RawAnswer = { selectedOptionIds: string[]; text: string | null };

/** Corrige une réponse. Les questions ouvertes sont mises en attente de correction manuelle. */
export function gradeAnswer(q: Q, a: RawAnswer) {
  const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
  const selected = a.selectedOptionIds.filter((id) => q.options.some((o) => o.id === id));

  switch (q.type) {
    case "SINGLE":
    case "TRUE_FALSE": {
      const ok = selected.length === 1 && correctIds.includes(selected[0]);
      return { pointsAwarded: ok ? q.points : 0, isCorrect: ok, needsReview: false };
    }
    case "MULTIPLE": {
      // Crédit partiel : (bonnes cochées − mauvaises cochées) / nb bonnes, borné à [0, 1]
      if (!correctIds.length) return { pointsAwarded: 0, isCorrect: selected.length === 0, needsReview: false };
      const good = selected.filter((id) => correctIds.includes(id)).length;
      const bad = selected.length - good;
      const ratio = Math.max(0, (good - bad) / correctIds.length);
      return { pointsAwarded: round2(ratio * q.points), isCorrect: ratio === 1, needsReview: false };
    }
    case "SHORT": {
      const given = normalizeText(a.text ?? "");
      const ok = !!given && q.acceptedAnswers.some((acc) => normalizeText(acc) === given);
      return { pointsAwarded: ok ? q.points : 0, isCorrect: ok, needsReview: false };
    }
    case "OPEN":
      return { pointsAwarded: 0, isCorrect: null, needsReview: true };
  }
}

/** Recalcule le score d'une tentative à partir des réponses enregistrées. */
export async function recomputeAttempt(attemptId: string) {
  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: true,
      quiz: { include: { questions: true, lesson: { select: { id: true, module: { select: { courseId: true } } } } } },
    },
  });
  if (!attempt) return null;

  const maxScore = attempt.quiz.questions.reduce((s, q) => s + q.points, 0);
  const score = attempt.answers.reduce((s, a) => s + a.pointsAwarded, 0);
  const percent = maxScore > 0 ? round2((score / maxScore) * 100) : 100;
  const pending = attempt.answers.some((a) => a.needsReview);
  const passed = !pending && percent >= attempt.quiz.passingScore;

  const updated = await db.quizAttempt.update({
    where: { id: attemptId },
    data: {
      score: round2(score),
      maxScore,
      percent,
      passed,
      status: pending ? "PENDING_REVIEW" : "GRADED",
    },
  });

  // Une tentative réussie (ou en attente de correction, ou un quiz non noté) débloque la suite du parcours.
  if (passed || pending || !attempt.quiz.graded) {
    await completeLesson(attempt.userId, attempt.quiz.lesson.id, percent);
  } else {
    await evaluateCourseCompletion(attempt.userId, attempt.quiz.lesson.module.courseId);
  }
  return updated;
}

export function shuffle<T>(arr: T[], seed: string) {
  // Mélange déterministe (même ordre pour une tentative donnée)
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
