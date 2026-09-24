import "server-only";
import { db } from "./db";
import { getCourseOutline, getLearnerResults } from "./progress";

export async function getGradebook(courseId: string) {
  const [evaluations, enrollments] = await Promise.all([
    db.lesson.findMany({
      where: { module: { courseId }, type: { in: ["QUIZ", "ASSIGNMENT"] }, published: true },
      orderBy: [{ module: { position: "asc" } }, { position: "asc" }],
      select: { id: true, title: true, type: true, module: { select: { position: true } } },
    }),
    db.enrollment.findMany({
      where: { courseId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);
  const rows = await Promise.all(
    enrollments.map(async (e) => {
      const [outline, res, cert] = await Promise.all([
        getCourseOutline(courseId, e.userId, { ignoreLocks: true }),
        getLearnerResults(e.userId, courseId),
        db.certificate.findUnique({ where: { userId_courseId: { userId: e.userId, courseId } }, select: { code: true } }),
      ]);
      return {
        user: e.user,
        status: e.status,
        enrolledAt: e.enrolledAt,
        completedAt: e.completedAt,
        progress: outline?.percent ?? 0,
        average: res.average,
        byLesson: new Map(res.results.map((r) => [r.lessonId, r])),
        certificate: cert?.code ?? null,
      };
    }),
  );
  return { evaluations, rows };
}
