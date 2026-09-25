import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { markAllNotificationsReadAction, openNotificationAction } from "@/app/actions/learner-extra";
import { Container, Empty, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function Notifications() {
  const user = await requireUser();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  async function open(id: string, link: string | null) {
    "use server";
    await openNotificationAction(id);
    redirect(link || "/notifications");
  }
  return (
    <Container className="max-w-3xl">
      <PageHeader
        title="Notifications"
        actions={
          items.some((i) => !i.readAt) ? (
            <form action={markAllNotificationsReadAction}>
              <SubmitButton className="btn-secondary btn-sm">Tout marquer comme lu</SubmitButton>
            </form>
          ) : null
        }
      />
      {items.length === 0 ? (
        <Empty title="Aucune notification" />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <form action={open.bind(null, n.id, n.link)}>
                <button className={cn("card w-full p-4 text-left", !n.readAt && "border-brand-300 bg-brand-50")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{!n.readAt && "● "}{n.title}</div>
                      {n.body && <div className="mt-1 text-sm text-slate-600">{n.body}</div>}
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">{formatDate(n.createdAt, true)}</span>
                  </div>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-center text-xs text-slate-500">
        <Link href="/profile" className="hover:underline">Gérer mon compte</Link>
      </p>
    </Container>
  );
}
