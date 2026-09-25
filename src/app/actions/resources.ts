"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { assertCanManageCourse, courseIdForModule } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { readUpload } from "@/lib/uploads";
import { safeUrl, str } from "@/lib/utils";

export type ResourceState = { error?: string; ok?: string } | undefined;

/** Ajout d'une ressource (fichier ou lien) à un module, par l'équipe pédagogique de la formation. */
export async function addResourceAction(moduleId: string, _: ResourceState, fd: FormData): Promise<ResourceState> {
  const user = await requireStaff();
  const courseId = await courseIdForModule(String(moduleId));
  await assertCanManageCourse(user, courseId);
  const title = str(fd, "title").slice(0, 160);
  if (title.length < 2) return { error: "Donnez un titre à la ressource." };
  const url = safeUrl(str(fd, "url"));
  if (str(fd, "url") && (!url || !/^https:\/\//.test(url))) return { error: "Lien invalide (https uniquement)." };
  const up = await readUpload(fd, { kind: "resource", required: !url });
  if ("error" in up) return up;
  const count = await db.resource.count({ where: { moduleId } });
  if (count >= 50) return { error: "50 ressources maximum par module." };
  const r = await db.resource.create({
    data: {
      moduleId,
      title,
      description: str(fd, "description").slice(0, 1000) || null,
      url: up.file ? null : url,
      ...(up.file ? { fileName: up.file.fileName, fileType: up.file.fileType, size: up.file.size, data: up.file.data } : {}),
      position: count,
      createdById: user.id,
    },
  });
  const org = await db.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
  await audit("resource.create", { actorId: user.id, organizationId: org?.organizationId, entityType: "Resource", entityId: r.id, details: title });
  revalidatePath(`/of/courses/${courseId}`);
  return { ok: "Ressource ajoutée." };
}

export async function deleteResourceAction(resourceId: string) {
  const user = await requireStaff();
  const r = await db.resource.findUnique({ where: { id: String(resourceId) }, select: { id: true, title: true, moduleId: true } });
  if (!r) throw new Error("Ressource introuvable");
  const courseId = await courseIdForModule(r.moduleId);
  await assertCanManageCourse(user, courseId);
  await db.resource.delete({ where: { id: r.id } });
  const org = await db.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
  await audit("resource.delete", { actorId: user.id, organizationId: org?.organizationId, entityType: "Resource", entityId: r.id, details: r.title });
  revalidatePath(`/of/courses/${courseId}`);
}
