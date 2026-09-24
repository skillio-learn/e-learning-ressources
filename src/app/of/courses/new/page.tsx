import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCourseAction } from "@/app/actions/of";
import { CourseForm } from "@/components/of/CourseForm";
import { Container, PageHeader } from "@/components/ui";

export const metadata = { title: "Nouvelle formation" };

export default async function NewCourse() {
  const user = await requireStaff();
  const organizations = user.role === "ADMIN" ? await db.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : undefined;
  return (
    <Container className="max-w-4xl">
      <PageHeader title="Nouvelle formation" back={{ href: "/of/courses", label: "Mes formations" }} />
      <CourseForm action={createCourseAction} isNew organizations={organizations} />
    </Container>
  );
}
