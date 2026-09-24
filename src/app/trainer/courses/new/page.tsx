import { requireRole } from "@/lib/auth";
import { createCourseAction } from "@/app/actions/trainer";
import { CourseForm } from "@/components/trainer/CourseForm";
import { Container, PageHeader } from "@/components/ui";

export const metadata = { title: "Nouvelle formation" };

export default async function NewCourse() {
  await requireRole("ADMIN", "TRAINER");
  return (
    <Container className="max-w-4xl">
      <PageHeader title="Nouvelle formation" back={{ href: "/trainer/courses", label: "Mes formations" }} />
      <CourseForm action={createCourseAction} isNew />
    </Container>
  );
}
