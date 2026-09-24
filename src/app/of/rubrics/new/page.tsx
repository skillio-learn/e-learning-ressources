import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { manageableCoursesWhere } from "@/lib/permissions";
import { RubricEditor } from "@/components/rubric/RubricEditor";
import { Container, PageHeader } from "@/components/ui";

export const metadata = { title: "Nouvelle grille" };

const LEVELS = [
  { label: "Insuffisant", description: "", points: 0 },
  { label: "À améliorer", description: "", points: 1 },
  { label: "Satisfaisant", description: "", points: 2 },
  { label: "Excellent", description: "", points: 3 },
];

export default async function NewRubric({ searchParams }: { searchParams: Promise<{ courseId?: string; lessonId?: string }> }) {
  const user = await requireRole("ADMIN", "OF_ADMIN", "TRAINER");
  const { courseId, lessonId } = await searchParams;
  const courses = await db.course.findMany({ where: manageableCoursesWhere(user), select: { id: true, title: true }, orderBy: { title: "asc" } });
  const validCourse = courseId && courses.some((c) => c.id === courseId) ? courseId : null;
  return (
    <Container className="max-w-5xl">
      <PageHeader title="Nouvelle grille d'évaluation" back={{ href: "/of/rubrics", label: "Grilles" }} />
      <RubricEditor
        rubricId={null}
        courses={courses}
        attachToLessonId={validCourse ? lessonId : null}
        returnTo={validCourse && lessonId ? `/of/courses/${validCourse}/lessons/${lessonId}` : null}
        initial={{
          title: "",
          description: "",
          courseId: validCourse,
          passingScore: 50,
          criteria: [
            { title: "Pertinence du contenu", description: "", weight: 1, levels: LEVELS.map((l) => ({ ...l })) },
            { title: "Qualité technique", description: "", weight: 1, levels: LEVELS.map((l) => ({ ...l })) },
          ],
        }}
      />
    </Container>
  );
}
