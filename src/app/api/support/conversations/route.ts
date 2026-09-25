import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Conversations d'assistance de l'utilisateur connecté (widget), avec nombre de réponses non lues. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const conversations = await db.supportConversation.findMany({
    where: { userId: user.id },
    orderBy: { lastMessageAt: "desc" },
    take: 30,
    select: {
      id: true, subject: true, category: true, status: true, lastMessageAt: true, rating: true,
      _count: { select: { messages: { where: { fromStaff: true, system: false, readAt: null } } } },
    },
  });
  const org = user.organizationId
    ? await db.organization.findUnique({ where: { id: user.organizationId }, select: { name: true, supportEnabled: true, supportHours: true, supportResponseHours: true } })
    : null;
  return NextResponse.json({
    team: org?.name ?? "Vylia",
    enabled: org ? org.supportEnabled : true,
    hours: org?.supportHours ?? null,
    responseHours: org?.supportResponseHours ?? 24,
    unread: conversations.reduce((s, c) => s + c._count.messages, 0),
    conversations: conversations.map((c) => ({ id: c.id, subject: c.subject, category: c.category, status: c.status, lastMessageAt: c.lastMessageAt, rating: c.rating, unread: c._count.messages })),
  });
}
