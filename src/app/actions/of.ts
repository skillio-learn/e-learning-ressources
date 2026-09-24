"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CompletionMode, CourseLevel, CourseStatus, EnrollmentPolicy, LessonType, QuestionType, TrainingModality } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertCanManageCourse, canManageRubric, courseIdForLesson, courseIdForModule } from "@/lib/permissions";
import { completeLesson, evaluateCourseCompletion } from "@/lib/progress";
import { recomputeAttempt } from "@/lib/quiz";
import { bool, optFloat, optInt, optStr, randomCode, round2, safeUrl, slugify, str } from "@/lib/utils";

const staff = () => requireRole(...STAFF_ROLES);

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "formation";
  let slug = root;
  for (let i = 2; ; i++) {
    const found = await db.course.findUnique({ where: { slug }, select: { id: true } });
    if (!found || found.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
}

// ─────────────────────────────── Formations ───────────────────────────────

function courseData(fd: FormData) {
  return {
    title: str(fd, "title"),
    subtitle: optStr(fd, "subtitle"),
    description: optStr(fd, "description"),
    objectives: optStr(fd, "objectives"),
    prerequisites: optStr(fd, "prerequisites"),
    audience: optStr(fd, "audience"),
    category: optStr(fd, "category"),
    level: (str(fd, "level") || "BEGINNER") as CourseLevel,
    durationHours: optFloat(fd, "durationHours"),
    coverUrl: safeUrl(str(fd, "coverUrl")),
    enrollmentPolicy: (str(fd, "enrollmentPolicy") || "INVITE") as EnrollmentPolicy,
    sequential: bool(fd, "sequential"),
    certificateEnabled: bool(fd, "certificateEnabled"),
    passingScore: Math.max(0, Math.min(100, optInt(fd, "passingScore") ?? 70)),
    modality: (str(fd, "modality") || "FOAD") as TrainingModality,
    rncpCode: optStr(fd, "rncpCode"),
    cpfEligible: bool(fd, "cpfEligible"),
    price: optFloat(fd, "price"),
    requiredDocuments: fd.getAll("requiredDocuments").map(String).filter(Boolean),
  };
}

export async function createCourseAction(fd: FormData) {
  const user = await staff();
  const data = courseData(fd);
  if (!data.title) throw new Error("Le titre est obligatoire");
  const organizationId = user.role === "ADMIN" ? str(fd, "organizationId") || user.organizationId : user.organizationId;
  if (!organizationId) throw new Error("Choisissez l'organisme de formation");
  const course = await db.course.create({
    data: { ...data, slug: await uniqueSlug(data.title), authorId: user.id, organizationId },
  });
  // Création rapide de la structure : N modules
  const modules = optInt(fd, "moduleCount") ?? 0;
  for (let i = 0; i < Math.min(modules, 30); i++) {
    await db.module.create({ data: { courseId: course.id, title: `Module ${i + 1}`, position: i } });
  }
  redirect(`/of/courses/${course.id}`);
}

export async function updateCourseAction(courseId: string, fd: FormData) {
  const user = await staff();
  await assertCanManageCourse(user, courseId);
  const data = courseData(fd);
  if (!data.title) throw new Error("Le titre est obligatoire");
  const slugInput = str(fd, "slug");
  const slug = await uniqueSlug(slugInput || data.title, courseId);
  const orgPatch = user.role === "ADMIN" && str(fd, "organizationId") ? { organizationId: str(fd, "organizationId") } : {};
  await db.course.update({ where: { id: courseId }, data: { ...data, slug, ...orgPatch } });
  revalidatePath(`/of/courses/${courseId}`, "layout");
}

export async function setCourseStatusAction(courseId: string, status: CourseStatus) {
  const user = await staff();
  await assertCanManageCourse(user, courseId);
  await db.course.update({ where: { id: courseId }, data: { status } });
  revalidatePath(`/of/courses/${courseId}`, "layout");
  revalidatePath("/courses");
}

export async function deleteCourseAction(courseId: string) {
  const user = await staff();
  await assertCanManageCourse(user, courseId);
  await db.course.delete({ where: { id: courseId } });
  redirect("/of/courses");
}

export async function duplicateCourseAction(courseId: string) {
  const user = await staff();
  await assertCanManageCourse(user, courseId);
  const src = await db.course.findUniqueOrThrow({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            include: { quiz: { include: { questions: { include: { options: true } } } } },
          },
        },
      },
    },
  });
  const { id: _id, slug: _slug, createdAt: _c, updatedAt: _u, modules, authorId: _a, ...rest } = src;
  const copy = await db.course.create({
    data: { ...rest, title: `${src.title} (copie)`, slug: await uniqueSlug(`${src.title} copie`), status: "DRAFT", authorId: user.id },
  });
  for (const m of modules) {
    const nm = await db.module.create({ data: { courseId: copy.id, title: m.title, description: m.description, position: m.position } });
    for (const l of m.lessons) {
      const { id: _lid, moduleId: _mid, createdAt: _lc, updatedAt: _lu, quiz, ...lrest } = l;
      const nl = await db.lesson.create({ data: { ...lrest, moduleId: nm.id } });
      if (quiz) {
        const { id: _qid, lessonId: _ql, questions, ...qrest } = quiz;
        await db.quiz.create({
          data: {
            ...qrest,
            lessonId: nl.id,
            questions: {
              create: questions.map(({ id: _q, quizId: _qz, options, ...q }) => ({
                ...q,
                options: { create: options.map(({ id: _o, questionId: _oq, ...o }) => o) },
              })),
            },
          },
        });
      }
    }
  }
  redirect(`/of/courses/${copy.id}`);
}

export async function addCoTrainerAction(courseId: string, fd: FormData) {
  const user = await staff();
  await assertCanManageCourse(user, courseId);
  const email = str(fd, "email").toLowerCase();
  const trainer = await db.user.findUnique({ where: { email } });
  if (!trainer || trainer.role === "LEARNER") throw new Error("Aucun formateur avec cet email");
  await db.courseTrainer.upsert({
    where: { courseId_userId: { courseId, userId: trainer.id } },
    create: { courseId, userId: trainer.id },
    update: {},
  });
  revalidatePath(`/of/courses/${courseId}/settings`);
}

export async function removeCoTrainerAction(courseId: string, userId: string) {
  const user = await staff();
  await assertCanManageCourse(user, courseId);
  await db.courseTrainer.delete({ where: { courseId_userId: { courseId, userId } } });
  revalidatePath(`/of/courses/${courseId}/settings`);
}

// ─────────────────────────────── Modules ───────────────────────────────

export async function addModuleAction(courseId: string, fd: FormData) {
  const user = await staff();
  await assertCanManageCourse(user, courseId);
  const count = await db.module.count({ where: { courseId } });
  await db.module.create({
    data: { courseId, title: str(fd, "title") || `Module ${count + 1}`, description: optStr(fd, "description"), position: count },
  });
  revalidatePath(`/of/courses/${courseId}`);
}

export async function updateModuleAction(moduleId: string, fd: FormData) {
  const user = await staff();
  const courseId = await courseIdForModule(moduleId);
  await assertCanManageCourse(user, courseId);
  await db.module.update({
    where: { id: moduleId },
    data: { title: str(fd, "title") || "Module", description: optStr(fd, "description") },
  });
  revalidatePath(`/of/courses/${courseId}`);
}

export async function deleteModuleAction(moduleId: string) {
  const user = await staff();
  const courseId = await courseIdForModule(moduleId);
  await assertCanManageCourse(user, courseId);
  await db.module.delete({ where: { id: moduleId } });
  await normalizeModulePositions(courseId);
  revalidatePath(`/of/courses/${courseId}`);
}

async function normalizeModulePositions(courseId: string) {
  const mods = await db.module.findMany({ where: { courseId }, orderBy: { position: "asc" }, select: { id: true } });
  await db.$transaction(mods.map((m, i) => db.module.update({ where: { id: m.id }, data: { position: i } })));
}

export async function moveModuleAction(moduleId: string, dir: -1 | 1) {
  const user = await staff();
  const courseId = await courseIdForModule(moduleId);
  await assertCanManageCourse(user, courseId);
  const mods = await db.module.findMany({ where: { courseId }, orderBy: { position: "asc" }, select: { id: true } });
  const i = mods.findIndex((m) => m.id === moduleId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= mods.length) return;
  [mods[i], mods[j]] = [mods[j], mods[i]];
  await db.$transaction(mods.map((m, k) => db.module.update({ where: { id: m.id }, data: { position: k } })));
  revalidatePath(`/of/courses/${courseId}`);
}

// ─────────────────────────────── Leçons ───────────────────────────────

async function createLesson(moduleId: string, title: string, type: LessonType, extra: Partial<{ embedUrl: string | null }> = {}) {
  const count = await db.lesson.count({ where: { moduleId } });
  const lesson = await db.lesson.create({
    data: { moduleId, title, type, position: count, completionMode: type === "INTERACTIVE" ? "MANUAL" : "MANUAL", ...extra },
  });
  if (type === "QUIZ") await db.quiz.create({ data: { lessonId: lesson.id } });
  return lesson;
}

export async function addLessonAction(moduleId: string, fd: FormData) {
  const user = await staff();
  const courseId = await courseIdForModule(moduleId);
  await assertCanManageCourse(user, courseId);
  const type = (str(fd, "type") || "CONTENT") as LessonType;
  const lesson = await createLesson(moduleId, str(fd, "title") || "Nouvelle leçon", type);
  redirect(`/of/courses/${courseId}/lessons/${lesson.id}`);
}

/**
 * Création en masse : une leçon par ligne.
 * Format de ligne accepté :  Titre  |  URL du module interactif (facultatif)
 */
export async function bulkAddLessonsAction(moduleId: string, fd: FormData) {
  const user = await staff();
  const courseId = await courseIdForModule(moduleId);
  await assertCanManageCourse(user, courseId);
  const type = (str(fd, "type") || "INTERACTIVE") as LessonType;
  const lines = str(fd, "lines")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 100);
  for (const line of lines) {
    const [title, url] = line.split("|").map((s) => s.trim());
    const embedUrl = safeUrl(url);
    await createLesson(moduleId, title || "Leçon", embedUrl ? "INTERACTIVE" : type, { embedUrl });
  }
  revalidatePath(`/of/courses/${courseId}`);
}

export async function updateLessonAction(lessonId: string, fd: FormData) {
  const user = await staff();
  const courseId = await courseIdForLesson(lessonId);
  await assertCanManageCourse(user, courseId);

  let htmlContent: string | null | undefined = undefined;
  const file = fd.get("htmlFile");
  if (file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) throw new Error("Fichier HTML trop volumineux (5 Mo max)");
    htmlContent = await file.text();
  } else if (fd.has("htmlContent")) {
    htmlContent = str(fd, "htmlContent") || null;
  }
  if (bool(fd, "removeHtml")) htmlContent = null;

  const rubricId = optStr(fd, "rubricId");
  if (rubricId && !(await canManageRubric(user, rubricId))) {
    const r = await db.rubric.findUnique({ where: { id: rubricId }, select: { courseId: true } });
    if (!r || (r.courseId && r.courseId !== courseId)) throw new Error("Grille non autorisée");
  }

  const newModuleId = optStr(fd, "moduleId");
  let moveTo: { moduleId: string; position: number } | null = null;
  const current = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { moduleId: true } });
  if (newModuleId && newModuleId !== current.moduleId) {
    const target = await db.module.findUnique({ where: { id: newModuleId }, select: { courseId: true } });
    if (target?.courseId === courseId) moveTo = { moduleId: newModuleId, position: await db.lesson.count({ where: { moduleId: newModuleId } }) };
  }

  await db.lesson.update({
    where: { id: lessonId },
    data: {
      title: str(fd, "title") || "Leçon",
      summary: optStr(fd, "summary"),
      type: (str(fd, "type") || undefined) as LessonType | undefined,
      durationMin: optInt(fd, "durationMin"),
      minTimeSec: optFloat(fd, "minTimeMin") ? Math.round((optFloat(fd, "minTimeMin") ?? 0) * 60) : null,
      required: bool(fd, "required"),
      published: bool(fd, "published"),
      content: optStr(fd, "content"),
      embedUrl: safeUrl(str(fd, "embedUrl")),
      videoUrl: safeUrl(str(fd, "videoUrl")),
      resourceUrl: safeUrl(str(fd, "resourceUrl")),
      completionMode: (str(fd, "completionMode") || "MANUAL") as CompletionMode,
      rubricId,
      ...(htmlContent !== undefined ? { htmlContent } : {}),
      ...(moveTo ?? {}),
    },
  });
  if (moveTo) await normalizeLessonPositions(current.moduleId);

  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { type: true, quiz: { select: { id: true } } } });
  if (lesson.type === "QUIZ" && !lesson.quiz) await db.quiz.create({ data: { lessonId } });

  revalidatePath(`/of/courses/${courseId}`, "layout");
}

async function normalizeLessonPositions(moduleId: string) {
  const ls = await db.lesson.findMany({ where: { moduleId }, orderBy: { position: "asc" }, select: { id: true } });
  await db.$transaction(ls.map((l, i) => db.lesson.update({ where: { id: l.id }, data: { position: i } })));
}

export async function deleteLessonAction(lessonId: string) {
  const user = await staff();
  const courseId = await courseIdForLesson(lessonId);
  await assertCanManageCourse(user, courseId);
  const l = await db.lesson.delete({ where: { id: lessonId } });
  await normalizeLessonPositions(l.moduleId);
  redirect(`/of/courses/${courseId}`);
}

export async function duplicateLessonAction(lessonId: string) {
  const user = await staff();
  const courseId = await courseIdForLesson(lessonId);
  await assertCanManageCourse(user, courseId);
  const l = await db.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: { quiz: { include: { questions: { include: { options: true } } } } },
  });
  const { id: _id, createdAt: _c, updatedAt: _u, quiz, ...rest } = l;
  await db.lesson.updateMany({ where: { moduleId: l.moduleId, position: { gt: l.position } }, data: { position: { increment: 1 } } });
  const copy = await db.lesson.create({ data: { ...rest, title: `${l.title} (copie)`, position: l.position + 1 } });
  if (quiz) {
    const { id: _q, lessonId: _ql, questions, ...qrest } = quiz;
    await db.quiz.create({
      data: {
        ...qrest,
        lessonId: copy.id,
        questions: {
          create: questions.map(({ id: _qq, quizId: _qz, options, ...q }) => ({
            ...q,
            options: { create: options.map(({ id: _o, questionId: _oq, ...o }) => o) },
          })),
        },
      },
    });
  }
  revalidatePath(`/of/courses/${courseId}`);
}

export async function moveLessonAction(lessonId: string, dir: -1 | 1) {
  const user = await staff();
  const courseId = await courseIdForLesson(lessonId);
  await assertCanManageCourse(user, courseId);
  const l = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { moduleId: true } });
  const ls = await db.lesson.findMany({ where: { moduleId: l.moduleId }, orderBy: { position: "asc" }, select: { id: true } });
  const i = ls.findIndex((x) => x.id === lessonId);
  const j = i + dir;
  if (j < 0 || j >= ls.length) return;
  [ls[i], ls[j]] = [ls[j], ls[i]];
  await db.$transaction(ls.map((x, k) => db.lesson.update({ where: { id: x.id }, data: { position: k } })));
  revalidatePath(`/of/courses/${courseId}`);
}

// ─────────────────────────────── Quiz ───────────────────────────────

export async function updateQuizSettingsAction(quizId: string, fd: FormData) {
  const user = await staff();
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId }, select: { lessonId: true } });
  const courseId = await courseIdForLesson(quiz.lessonId);
  await assertCanManageCourse(user, courseId);
  await db.quiz.update({
    where: { id: quizId },
    data: {
      instructions: optStr(fd, "instructions"),
      passingScore: Math.max(0, Math.min(100, optInt(fd, "passingScore") ?? 70)),
      maxAttempts: optInt(fd, "maxAttempts") || null,
      timeLimitMin: optInt(fd, "timeLimitMin") || null,
      shuffleQuestions: bool(fd, "shuffleQuestions"),
      showCorrection: bool(fd, "showCorrection"),
      graded: bool(fd, "graded"),
    },
  });
  revalidatePath(`/of/courses/${courseId}/lessons/${quiz.lessonId}`);
}

export type QuestionInput = {
  id?: string;
  type: QuestionType;
  text: string;
  explanation?: string | null;
  points: number;
  acceptedAnswers?: string[];
  options: { text: string; isCorrect: boolean }[];
};

function normalizeQuestion(q: QuestionInput) {
  const type = q.type;
  let options = (q.options ?? []).filter((o) => o.text.trim()).map((o, i) => ({ text: o.text.trim(), isCorrect: !!o.isCorrect, position: i }));
  if (type === "TRUE_FALSE") {
    const trueCorrect = q.options?.[0]?.isCorrect ?? true;
    options = [
      { text: "Vrai", isCorrect: trueCorrect, position: 0 },
      { text: "Faux", isCorrect: !trueCorrect, position: 1 },
    ];
  }
  if (type === "SHORT" || type === "OPEN") options = [];
  if (type === "SINGLE" && options.filter((o) => o.isCorrect).length > 1) {
    let seen = false;
    options = options.map((o) => {
      if (o.isCorrect && !seen) return (seen = true), o;
      return { ...o, isCorrect: false };
    });
  }
  if (!q.text.trim()) throw new Error("L'énoncé de la question est obligatoire");
  if ((type === "SINGLE" || type === "MULTIPLE") && options.length < 2) throw new Error("Ajoutez au moins 2 propositions");
  if ((type === "SINGLE" || type === "MULTIPLE") && !options.some((o) => o.isCorrect)) throw new Error("Indiquez au moins une bonne réponse");
  return {
    type,
    text: q.text.trim(),
    explanation: q.explanation?.trim() || null,
    points: Math.max(0, Number(q.points) || 1),
    acceptedAnswers: type === "SHORT" ? (q.acceptedAnswers ?? []).map((s) => s.trim()).filter(Boolean) : [],
    options,
  };
}

export async function saveQuestionAction(quizId: string, input: QuestionInput) {
  const user = await staff();
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId }, select: { lessonId: true } });
  const courseId = await courseIdForLesson(quiz.lessonId);
  await assertCanManageCourse(user, courseId);
  const { options, ...q } = normalizeQuestion(input);

  if (input.id) {
    const existing = await db.question.findUnique({ where: { id: input.id }, select: { quizId: true } });
    if (existing?.quizId !== quizId) throw new Error("Question introuvable");
    await db.$transaction([
      db.questionOption.deleteMany({ where: { questionId: input.id } }),
      db.question.update({ where: { id: input.id }, data: { ...q, options: { create: options } } }),
    ]);
  } else {
    const count = await db.question.count({ where: { quizId } });
    await db.question.create({ data: { ...q, quizId, position: count, options: { create: options } } });
  }
  revalidatePath(`/of/courses/${courseId}/lessons/${quiz.lessonId}`);
  return { ok: true };
}

export async function deleteQuestionAction(questionId: string) {
  const user = await staff();
  const q = await db.question.findUniqueOrThrow({ where: { id: questionId }, select: { quizId: true, quiz: { select: { lessonId: true } } } });
  const courseId = await courseIdForLesson(q.quiz.lessonId);
  await assertCanManageCourse(user, courseId);
  await db.question.delete({ where: { id: questionId } });
  const rest = await db.question.findMany({ where: { quizId: q.quizId }, orderBy: { position: "asc" }, select: { id: true } });
  await db.$transaction(rest.map((x, i) => db.question.update({ where: { id: x.id }, data: { position: i } })));
  revalidatePath(`/of/courses/${courseId}/lessons/${q.quiz.lessonId}`);
}

export async function moveQuestionAction(questionId: string, dir: -1 | 1) {
  const user = await staff();
  const q = await db.question.findUniqueOrThrow({ where: { id: questionId }, select: { quizId: true, quiz: { select: { lessonId: true } } } });
  const courseId = await courseIdForLesson(q.quiz.lessonId);
  await assertCanManageCourse(user, courseId);
  const qs = await db.question.findMany({ where: { quizId: q.quizId }, orderBy: { position: "asc" }, select: { id: true } });
  const i = qs.findIndex((x) => x.id === questionId);
  const j = i + dir;
  if (j < 0 || j >= qs.length) return;
  [qs[i], qs[j]] = [qs[j], qs[i]];
  await db.$transaction(qs.map((x, k) => db.question.update({ where: { id: x.id }, data: { position: k } })));
  revalidatePath(`/of/courses/${courseId}/lessons/${q.quiz.lessonId}`);
}

/**
 * Import rapide de questions au format texte :
 *
 *   ? Quelle est la capitale de la France ?
 *   - Lyon
 *   + Paris
 *   - Marseille
 *   > Explication facultative
 *
 * « + » = bonne réponse, « - » = mauvaise. Plusieurs « + » → QCM multiple.
 * « = réponse » → réponse courte ; aucune proposition → question ouverte.
 * « ?VF » puis « + Vrai » ou « + Faux » → Vrai/Faux.
 */
export async function importQuestionsAction(quizId: string, fd: FormData) {
  const user = await staff();
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId }, select: { lessonId: true } });
  const courseId = await courseIdForLesson(quiz.lessonId);
  await assertCanManageCourse(user, courseId);

  const blocks = str(fd, "text").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  let position = await db.question.count({ where: { quizId } });
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let text = "";
    let tf = false;
    let explanation: string | null = null;
    const options: { text: string; isCorrect: boolean }[] = [];
    const accepted: string[] = [];
    for (const line of lines) {
      if (/^\?vf\s/i.test(line)) (tf = true), (text = line.slice(3).trim());
      else if (line.startsWith("?")) text = line.slice(1).trim();
      else if (line.startsWith("+")) options.push({ text: line.slice(1).trim(), isCorrect: true });
      else if (line.startsWith("-")) options.push({ text: line.slice(1).trim(), isCorrect: false });
      else if (line.startsWith("=")) accepted.push(line.slice(1).trim());
      else if (line.startsWith(">")) explanation = line.slice(1).trim();
      else text = text ? `${text}\n${line}` : line;
    }
    if (!text) continue;
    let type: QuestionType;
    if (tf) {
      const trueCorrect = options.some((o) => o.isCorrect && /^vrai$/i.test(o.text));
      options.splice(0, options.length, { text: "Vrai", isCorrect: trueCorrect }, { text: "Faux", isCorrect: !trueCorrect });
      type = "TRUE_FALSE";
    } else if (accepted.length) type = "SHORT";
    else if (!options.length) type = "OPEN";
    else type = options.filter((o) => o.isCorrect).length > 1 ? "MULTIPLE" : "SINGLE";
    try {
      const { options: opts, ...q } = normalizeQuestion({ type, text, explanation, points: 1, acceptedAnswers: accepted, options });
      await db.question.create({ data: { ...q, quizId, position: position++, options: { create: opts } } });
    } catch {
      // bloc invalide ignoré
    }
  }
  revalidatePath(`/of/courses/${courseId}/lessons/${quiz.lessonId}`);
}

// ─────────────────────────────── Inscriptions ───────────────────────────────

/** Inscrit des apprenants par email (un par ligne). Crée les comptes manquants avec un mot de passe temporaire. */
export type EnrollResult = { enrolled: number; created: { email: string; password: string }[]; notFound: string[] } | null;

export async function enrollLearnersAction(courseId: string, _prev: EnrollResult, fd: FormData): Promise<EnrollResult> {
  const user = await staff();
  await assertCanManageCourse(user, courseId);
  const createMissing = bool(fd, "createMissing");
  const lines = str(fd, "emails")
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const created: { email: string; password: string }[] = [];
  const notFound: string[] = [];
  let enrolled = 0;
  for (const line of lines) {
    // Format : email  ou  Nom <email>  ou  email Nom Prénom
    const m = line.match(/^(.*?)<([^>]+)>$/);
    const email = (m ? m[2] : line.split(/\s+/)[0]).toLowerCase();
    const name = (m ? m[1] : line.split(/\s+/).slice(1).join(" ")).trim() || email.split("@")[0];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
    let learner = await db.user.findUnique({ where: { email } });
    if (!learner) {
      if (!createMissing) {
        notFound.push(email);
        continue;
      }
      const password = randomCode(10) + "7";
      const courseOrg = await db.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
      learner = await db.user.create({
        data: { email, name, passwordHash: await bcrypt.hash(password, 10), role: "LEARNER", organizationId: courseOrg?.organizationId },
      });
      created.push({ email, password });
    }
    const enr = await db.enrollment.upsert({
      where: { userId_courseId: { userId: learner.id, courseId } },
      create: { userId: learner.id, courseId, enrolledById: user.id, startDate: new Date() },
      update: { status: "ACTIVE" },
    });
    await audit("enrollment.create", { actorId: user.id, entityType: "Enrollment", entityId: enr.id, details: { direct: true, email } });
    enrolled++;
  }
  revalidatePath(`/of/courses/${courseId}/learners`);
  return { enrolled, created, notFound };
}

export async function setEnrollmentStatusAction(enrollmentId: string, status: "ACTIVE" | "SUSPENDED") {
  const user = await staff();
  const e = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
  await assertCanManageCourse(user, e.courseId);
  await db.enrollment.update({ where: { id: enrollmentId }, data: { status } });
  revalidatePath(`/of/courses/${e.courseId}/learners`);
}

export async function removeEnrollmentAction(enrollmentId: string) {
  const user = await staff();
  const e = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
  await assertCanManageCourse(user, e.courseId);
  await db.enrollment.delete({ where: { id: enrollmentId } });
  revalidatePath(`/of/courses/${e.courseId}/learners`);
}

/** Valide manuellement une étape pour un apprenant (ex. : présentiel, oral). */
export async function forceCompleteLessonAction(courseId: string, userId: string, lessonId: string) {
  const user = await staff();
  await assertCanManageCourse(user, courseId);
  if ((await courseIdForLesson(lessonId)) !== courseId) throw new Error("Leçon hors formation");
  await completeLesson(userId, lessonId);
  await audit("lesson.force_complete", { actorId: user.id, entityType: "Lesson", entityId: lessonId, details: { learner: userId, courseId } });
  revalidatePath(`/of/courses/${courseId}/learners/${userId}`);
}

export async function resetQuizAttemptsAction(courseId: string, userId: string, quizId: string) {
  const user = await staff();
  await assertCanManageCourse(user, courseId);
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId }, select: { lessonId: true } });
  if ((await courseIdForLesson(quiz.lessonId)) !== courseId) throw new Error("Quiz hors formation");
  await db.quizAttempt.deleteMany({ where: { quizId, userId } });
  await audit("quiz.reset_attempts", { actorId: user.id, entityType: "Quiz", entityId: quizId, details: { learner: userId, courseId } });
  revalidatePath(`/of/courses/${courseId}/learners/${userId}`);
}

// ─────────────────────────────── Corrections ───────────────────────────────

/** Correction manuelle d'une tentative de quiz (questions ouvertes, ajustement de points). */
export async function gradeAttemptAction(attemptId: string, fd: FormData) {
  const user = await staff();
  const attempt = await db.quizAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { answers: { include: { question: true } }, quiz: { select: { lessonId: true } } },
  });
  const courseId = await courseIdForLesson(attempt.quiz.lessonId);
  await assertCanManageCourse(user, courseId);

  for (const a of attempt.answers) {
    const pts = optFloat(fd, `points_${a.id}`);
    const feedback = optStr(fd, `feedback_${a.id}`);
    if (pts === null && feedback === null && !a.needsReview) continue;
    const points = pts === null ? a.pointsAwarded : Math.max(0, Math.min(a.question.points, pts));
    await db.answer.update({
      where: { id: a.id },
      data: {
        pointsAwarded: round2(points),
        isCorrect: points >= a.question.points,
        needsReview: pts === null ? a.needsReview : false,
        feedback,
      },
    });
  }
  await db.quizAttempt.update({ where: { id: attemptId }, data: { feedback: optStr(fd, "feedback") } });
  await recomputeAttempt(attemptId);
  const orgOf = await db.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
  await audit("grade.quiz", { actorId: user.id, organizationId: orgOf?.organizationId, entityType: "QuizAttempt", entityId: attemptId });
  revalidatePath(`/of/grading`);
  redirect(`/of/grading/attempts/${attemptId}?saved=1`);
}

/** Évaluation d'un devoir avec la grille critériée. */
export async function gradeSubmissionAction(submissionId: string, fd: FormData) {
  const user = await staff();
  const sub = await db.submission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      lesson: {
        select: {
          id: true,
          module: { select: { courseId: true } },
          rubric: { include: { criteria: { include: { levels: true } } } },
        },
      },
    },
  });
  const courseId = sub.lesson.module.courseId;
  await assertCanManageCourse(user, courseId);
  const rubric = sub.lesson.rubric;
  const decision = str(fd, "decision"); // "grade" | "revision"

  let score: number;
  let maxScore: number;
  let passingScore = 50;
  if (rubric) {
    passingScore = rubric.passingScore;
    score = 0;
    maxScore = 0;
    for (const c of rubric.criteria) {
      const levelId = optStr(fd, `level_${c.id}`);
      const level = c.levels.find((l) => l.id === levelId) ?? null;
      const cmax = Math.max(0, ...c.levels.map((l) => l.points));
      const custom = optFloat(fd, `points_${c.id}`);
      const pts = Math.max(0, Math.min(cmax, custom ?? level?.points ?? 0));
      score += pts * c.weight;
      maxScore += cmax * c.weight;
      await db.rubricScore.upsert({
        where: { submissionId_criterionId: { submissionId, criterionId: c.id } },
        create: { submissionId, criterionId: c.id, levelId: level?.id ?? null, points: pts, comment: optStr(fd, `comment_${c.id}`) },
        update: { levelId: level?.id ?? null, points: pts, comment: optStr(fd, `comment_${c.id}`) },
      });
    }
  } else {
    score = Math.max(0, optFloat(fd, "score") ?? 0);
    maxScore = Math.max(1, optFloat(fd, "maxScore") ?? 20);
    score = Math.min(score, maxScore);
  }
  const percent = maxScore > 0 ? round2((score / maxScore) * 100) : 0;
  await db.submission.update({
    where: { id: submissionId },
    data: {
      score: round2(score),
      maxScore: round2(maxScore),
      percent,
      passed: decision === "revision" ? false : percent >= passingScore,
      status: decision === "revision" ? "NEEDS_REVISION" : "GRADED",
      feedback: optStr(fd, "feedback"),
      gradedAt: new Date(),
      gradedById: user.id,
    },
  });
  await evaluateCourseCompletion(sub.userId, courseId);
  const orgOfSub = await db.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
  await audit("grade.submission", { actorId: user.id, organizationId: orgOfSub?.organizationId, entityType: "Submission", entityId: submissionId, details: { score, maxScore, decision } });
  revalidatePath(`/of/grading`);
  redirect(`/of/grading/submissions/${submissionId}?saved=1`);
}

// ─────────────────────────────── Grilles d'évaluation ───────────────────────────────

export type RubricInput = {
  title: string;
  description?: string | null;
  courseId?: string | null;
  passingScore: number;
  criteria: {
    title: string;
    description?: string | null;
    weight: number;
    levels: { label: string; description?: string | null; points: number }[];
  }[];
};

function cleanRubric(input: RubricInput) {
  if (!input.title?.trim()) throw new Error("Le titre de la grille est obligatoire");
  const criteria = input.criteria
    .filter((c) => c.title.trim())
    .map((c, i) => ({
      title: c.title.trim(),
      description: c.description?.trim() || null,
      weight: Math.max(0, Number(c.weight) || 1),
      position: i,
      levels: {
        create: c.levels
          .filter((l) => l.label.trim())
          .map((l, j) => ({ label: l.label.trim(), description: l.description?.trim() || null, points: Number(l.points) || 0, position: j })),
      },
    }));
  if (!criteria.length) throw new Error("Ajoutez au moins un critère");
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    passingScore: Math.max(0, Math.min(100, Number(input.passingScore) || 50)),
    criteria,
  };
}

export async function saveRubricAction(rubricId: string | null, input: RubricInput, attachToLessonId?: string | null) {
  const user = await staff();
  if (input.courseId) await assertCanManageCourse(user, input.courseId);
  const { criteria, ...data } = cleanRubric(input);
  if (rubricId) {
    if (!(await canManageRubric(user, rubricId))) throw new Error("Accès refusé");
    const used = await db.rubricScore.count({ where: { criterion: { rubricId } } });
    if (used > 0) throw new Error("Cette grille a déjà servi à évaluer des devoirs : dupliquez-la pour la modifier.");
    await db.$transaction([
      db.rubricCriterion.deleteMany({ where: { rubricId } }),
      db.rubric.update({ where: { id: rubricId }, data: { ...data, courseId: input.courseId || null, criteria: { create: criteria } } }),
    ]);
    revalidatePath("/of/rubrics");
    return { id: rubricId };
  }
  const r = await db.rubric.create({
    data: { ...data, courseId: input.courseId || null, authorId: user.id, criteria: { create: criteria } },
  });
  if (attachToLessonId) {
    const courseId = await courseIdForLesson(attachToLessonId);
    await assertCanManageCourse(user, courseId);
    await db.lesson.update({ where: { id: attachToLessonId }, data: { rubricId: r.id } });
  }
  revalidatePath("/of/rubrics");
  return { id: r.id };
}

export async function duplicateRubricAction(rubricId: string) {
  const user = await staff();
  const r = await db.rubric.findUniqueOrThrow({
    where: { id: rubricId },
    include: { criteria: { include: { levels: true } } },
  });
  const copy = await db.rubric.create({
    data: {
      title: `${r.title} (copie)`,
      description: r.description,
      passingScore: r.passingScore,
      courseId: r.courseId && (await canManageRubric(user, rubricId)) ? r.courseId : null,
      authorId: user.id,
      criteria: {
        create: r.criteria.map((c) => ({
          title: c.title,
          description: c.description,
          weight: c.weight,
          position: c.position,
          levels: { create: c.levels.map((l) => ({ label: l.label, description: l.description, points: l.points, position: l.position })) },
        })),
      },
    },
  });
  redirect(`/of/rubrics/${copy.id}`);
}

export async function deleteRubricAction(rubricId: string) {
  const user = await staff();
  if (!(await canManageRubric(user, rubricId))) throw new Error("Accès refusé");
  await db.rubric.delete({ where: { id: rubricId } });
  redirect("/of/rubrics");
}
