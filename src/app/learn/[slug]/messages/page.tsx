import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getLearnContext } from "@/lib/learn";
import { sendPedagogicalMessageAction } from "@/app/actions/compliance";
import { Thread } from "@/components/messages/Thread";
import { Composer } from "@/components/messages/Composer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messagerie de la formation" };

export default async function LearnerMessages({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { enrollment, preview } = await getLearnContext(slug);
  if (!enrollment || preview) notFound();
  await db.pedagogicalMessage.updateMany({ where: { enrollmentId: enrollment.id, fromStaff: true, readAt: null }, data: { readAt: new Date() } });
  const messages = await db.pedagogicalMessage.findMany({
    where: { enrollmentId: enrollment.id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true } } },
  });
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-10">
      <h1>Messagerie avec votre formateur</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        Une question sur un contenu, un exercice ou un problème technique ? Votre formateur vous répond sous 48 h ouvrées. Les échanges sont conservés.
      </p>
      <div className="card space-y-4 bg-slate-50 p-4">
        <Thread messages={messages} viewer="learner" />
        <Composer action={sendPedagogicalMessageAction.bind(null, enrollment.id)} placeholder="Votre question…" />
      </div>
    </div>
  );
}
