-- Supabase : les tables ne sont accessibles que via le serveur (Prisma, rôle postgres).
-- RLS activé sans politique = aucun accès via l'API REST publique (clé anon).
ALTER TABLE "public"."Answer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Certificate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CourseTrainer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Enrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Lesson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LessonProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Module" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Question" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."QuestionOption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Quiz" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."QuizAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Rubric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RubricCriterion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RubricLevel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RubricScore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Setting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Submission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
