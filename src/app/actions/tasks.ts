"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { optStr, str } from "@/lib/utils";

export type TState = { error?: string; ok?: string } | undefined;

async function staffOrg() {
  const user = await requireStaff();
  if (!user.organizationId) throw new Error("Aucun organisme rattaché");
  return { user, orgId: user.organizationId };
}

/** Lien interne uniquement (pas d'URL externe dans une tâche). */
const internalLink = (v: string | null) => (v && v.startsWith("/") && !v.startsWith("//") ? v.slice(0, 300) : null);

export async function createTaskAction(_: TState, fd: FormData): Promise<TState> {
  const { user, orgId } = await staffOrg();
  const title = str(fd, "title").slice(0, 200);
  if (title.length < 3) return { error: "Donnez un intitulé à la tâche." };
  const assigneeId = str(fd, "assigneeId") || user.id;
  const assignee = await db.user.findFirst({ where: { id: assigneeId, organizationId: orgId, role: { in: ["OF_ADMIN", "TRAINER"] }, active: true }, select: { id: true } });
  if (!assignee) return { error: "Membre de l'équipe introuvable." };
  const due = str(fd, "dueAt");
  const dueAt = due ? new Date(`${due}T18:00:00`) : null;
  const task = await db.task.create({
    data: {
      organizationId: orgId, title, notes: optStr(fd, "notes"), dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
      priority: str(fd, "priority") === "HIGH" ? "HIGH" : "NORMAL", assigneeId: assignee.id, createdById: user.id,
      link: internalLink(optStr(fd, "link")), linkLabel: optStr(fd, "linkLabel")?.slice(0, 120) ?? null,
    },
  });
  if (assignee.id !== user.id) await notify(assignee.id, "Nouvelle tâche", `${title}${task.dueAt ? ` · échéance le ${task.dueAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}` : ""}`, "/of/tasks");
  revalidatePath("/of/tasks");
  revalidatePath("/of/home");
  return { ok: "Tâche créée." };
}

export async function toggleTaskAction(id: string) {
  const { orgId } = await staffOrg();
  const t = await db.task.findFirstOrThrow({ where: { id, organizationId: orgId } });
  await db.task.update({ where: { id }, data: t.status === "OPEN" ? { status: "DONE", doneAt: new Date() } : { status: "OPEN", doneAt: null } });
  revalidatePath("/of/tasks");
  revalidatePath("/of/home");
}

export async function deleteTaskAction(id: string) {
  const { user, orgId } = await staffOrg();
  const t = await db.task.findFirstOrThrow({ where: { id, organizationId: orgId } });
  if (t.createdById !== user.id && user.role !== "OF_ADMIN") throw new Error("Seul l'auteur ou un responsable peut supprimer la tâche");
  await db.task.delete({ where: { id } });
  revalidatePath("/of/tasks");
}
