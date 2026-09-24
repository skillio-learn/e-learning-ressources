import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { canManageCourse, canManageOrg } from "@/lib/permissions";
import { sendPedagogicalMessageAction } from "@/app/actions/compliance";
import { Thread } from "@/components/messages/Thread";
import { Composer } from "@/components/messages/Composer";
import { Container, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conversation" };

export default async function OfThread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff();
  const e = await db.enrollment.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, email: true } }, course: { select: { id: true, title: true, organizationId: true } } } });
  if (!e || !((await canManageCourse(user, e.courseId)) || canManageOrg(user, e.course.organizationId))) notFound();
  await db.pedagogicalMessage.updateMany({ where: { enrollmentId: id, fromStaff: false, readAt: null }, data: { readAt: new Date() } });
  const messages = await db.pedagogicalMessage.findMany({ where: { enrollmentId: id }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } });
  return (
    <Container className="max-w-3xl">
      <PageHeader
        back={{ href: "/of/messages", label: "Messagerie" }}
        title={e.user.name}
        subtitle={<>{e.course.title} · <Link href={`/of/learners/${e.user.id}`} className="text-brand-600 hover:underline">fiche apprenant</Link></>}
      />
      <div className="card space-y-4 bg-slate-50 p-4">
        <Thread messages={messages} viewer="staff" />
        <Composer action={sendPedagogicalMessageAction.bind(null, id)} placeholder="Votre réponse à l'apprenant…" />
      </div>
    </Container>
  );
}
