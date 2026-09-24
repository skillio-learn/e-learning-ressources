import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageCourse } from "@/lib/permissions";
import { getGradebook } from "@/lib/gradebook";
import { formatDate, slugify, toCsv } from "@/lib/utils";

const statusFr = { ACTIVE: "En cours", COMPLETED: "Validée", SUSPENDED: "Suspendu" } as const;

export async function GET(_: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  const user = await getCurrentUser();
  if (!user || !(await canManageCourse(user, id))) return new NextResponse("Accès refusé", { status: 403 });
  const course = await db.course.findUnique({ where: { id }, select: { title: true } });
  if (!course) return new NextResponse("Introuvable", { status: 404 });

  let rows: unknown[][];
  if (kind === "gradebook") {
    const { evaluations, rows: data } = await getGradebook(id);
    rows = [
      ["Apprenant", "Email", "Inscrit le", "Progression (%)", ...evaluations.map((e) => `${e.type === "QUIZ" ? "Quiz" : "Devoir"} - ${e.title} (%)`), "Moyenne (%)", "Statut", "Validée le", "Certificat"],
      ...data.map((r) => [
        r.user.name,
        r.user.email,
        formatDate(r.enrolledAt),
        r.progress,
        ...evaluations.map((e) => {
          const res = r.byLesson.get(e.id);
          if (!res || res.attempts === 0) return "";
          return res.pending ? "en correction" : (res.percent ?? "");
        }),
        r.average ?? "",
        statusFr[r.status],
        r.completedAt ? formatDate(r.completedAt) : "",
        r.certificate ?? "",
      ]),
    ];
  } else if (kind === "attempts") {
    const attempts = await db.quizAttempt.findMany({
      where: { quiz: { lesson: { module: { courseId: id } } }, status: { not: "IN_PROGRESS" } },
      orderBy: [{ quiz: { lesson: { position: "asc" } } }, { submittedAt: "asc" }],
      include: {
        user: { select: { name: true, email: true } },
        quiz: { select: { lesson: { select: { title: true } } } },
        answers: { include: { question: { include: { options: true } } }, orderBy: { question: { position: "asc" } } },
      },
    });
    rows = [["Quiz", "Apprenant", "Email", "Remis le", "Score tentative (%)", "Réussi", "Question", "Réponse donnée", "Points obtenus", "Points max", "Correct", "Commentaire"]];
    for (const a of attempts) {
      for (const ans of a.answers) {
        const given = ans.question.options.length
          ? ans.question.options.filter((o) => ans.selectedOptionIds.includes(o.id)).map((o) => o.text).join(" | ")
          : (ans.text ?? "");
        rows.push([
          a.quiz.lesson.title, a.user.name, a.user.email, formatDate(a.submittedAt, true), a.percent, a.passed ? "oui" : "non",
          ans.question.text, given, ans.pointsAwarded, ans.question.points,
          ans.needsReview ? "à corriger" : ans.isCorrect ? "oui" : "non", ans.feedback ?? "",
        ]);
      }
    }
  } else if (kind === "rubrics") {
    const subs = await db.submission.findMany({
      where: { lesson: { module: { courseId: id } } },
      orderBy: [{ lesson: { position: "asc" } }, { submittedAt: "asc" }],
      include: {
        user: { select: { name: true, email: true } },
        gradedBy: { select: { name: true } },
        lesson: { select: { title: true, rubric: { select: { title: true } } } },
        rubricScores: { include: { criterion: true, level: true }, orderBy: { criterion: { position: "asc" } } },
      },
    });
    rows = [["Devoir", "Grille", "Apprenant", "Email", "Remis le", "Statut", "Critère", "Coefficient", "Niveau attribué", "Points", "Commentaire critère", "Note totale", "Note max", "Note (%)", "Validé", "Commentaire général", "Évalué par", "Évalué le"]];
    for (const s of subs) {
      const common = [s.lesson.title, s.lesson.rubric?.title ?? "", s.user.name, s.user.email, formatDate(s.submittedAt, true), s.status === "GRADED" ? "Évalué" : s.status === "NEEDS_REVISION" ? "À reprendre" : "À évaluer"];
      const tail = [s.score ?? "", s.maxScore ?? "", s.percent ?? "", s.passed === null ? "" : s.passed ? "oui" : "non", s.feedback ?? "", s.gradedBy?.name ?? "", s.gradedAt ? formatDate(s.gradedAt) : ""];
      if (!s.rubricScores.length) rows.push([...common, "", "", "", "", "", ...tail]);
      for (const rs of s.rubricScores) {
        rows.push([...common, rs.criterion.title, rs.criterion.weight, rs.level?.label ?? "", rs.points, rs.comment ?? "", ...tail]);
      }
    }
  } else {
    return new NextResponse("Export inconnu", { status: 404 });
  }

  const filename = `${slugify(course.title)}-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
