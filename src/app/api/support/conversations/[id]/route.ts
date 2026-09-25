import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Messages d'une conversation (demandeur ou équipe habilitée). Marque comme lus les messages de l'autre partie. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const c = await db.supportConversation.findUnique({ where: { id }, select: { id: true, userId: true, organizationId: true, subject: true, category: true, status: true, rating: true } });
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  const mine = c.userId === user.id;
  const staff = isStaff(user) && (user.role === "ADMIN" || (!!c.organizationId && c.organizationId === user.organizationId));
  if (!mine && !staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const messages = await db.supportMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: { id: true, body: true, fromStaff: true, system: true, createdAt: true, readAt: true, author: { select: { name: true } } },
  });
  await db.supportMessage.updateMany({ where: { conversationId: id, fromStaff: mine, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({
    conversation: c,
    messages: messages.map((m) => ({ id: m.id, body: m.body, fromStaff: m.fromStaff, system: m.system, createdAt: m.createdAt, author: m.system ? null : m.author?.name ?? null, read: !!m.readAt })),
  });
}
