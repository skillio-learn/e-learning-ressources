"use server";

import { revalidatePath } from "next/cache";
import type { EmploymentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOfManager, requireUser } from "@/lib/auth";
import { canManageOrg } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { notify, notifyOrgManagers } from "@/lib/notify";
import { PROFILE_FIELD_LABELS, learnerProfileEditable } from "@/lib/labels";
import { parseProfileForm, profileDiff } from "@/lib/profile";
import { readUpload } from "@/lib/uploads";
import { str } from "@/lib/utils";

export type ProfileState = { error?: string; ok?: string } | undefined;

type Changes = Record<string, { from: unknown; to: unknown }>;

function revalidateProfile(userId: string) {
  revalidatePath("/profile");
  revalidatePath(`/of/accounts/${userId}`);
  revalidatePath("/of/accounts");
  revalidatePath(`/of/learners/${userId}`);
}

/** Compte validé : l'apprenant soumet les informations corrigées, avec un motif et un justificatif. */
export async function requestProfileChangeAction(_: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await requireUser();
  if (user.role !== "LEARNER") return { error: "Réservé aux apprenants." };
  if (learnerProfileEditable(user.accountStatus)) return { error: "Votre dossier est en cours de constitution : modifiez directement vos informations." };
  if (await db.profileChangeRequest.findFirst({ where: { userId: user.id, status: "PENDING" }, select: { id: true } })) {
    return { error: "Une demande est déjà en cours d'examen par votre organisme." };
  }
  const parsed = parseProfileForm(fd);
  if ("error" in parsed) return parsed;
  const current = await db.learnerProfile.findUnique({ where: { userId: user.id } });
  const changes = profileDiff(current, parsed.data);
  if (!Object.keys(changes).length) return { error: "Aucune information n'a été modifiée." };
  const reason = str(fd, "reason").slice(0, 2000);
  if (reason.length < 10) return { error: "Expliquez le motif de la modification (10 caractères minimum)." };
  const up = await readUpload(fd, { key: "proof", required: false });
  if ("error" in up) return up;
  const req = await db.profileChangeRequest.create({
    data: {
      userId: user.id,
      organizationId: user.organizationId,
      changes: changes as Prisma.InputJsonValue,
      reason,
      ...(up.file ? { fileName: up.file.fileName, fileType: up.file.fileType, size: up.file.size, data: up.file.data } : {}),
    },
  });
  await audit("profile.change_request", {
    actorId: user.id,
    organizationId: user.organizationId,
    entityType: "ProfileChangeRequest",
    entityId: req.id,
    details: Object.keys(changes).map((k) => PROFILE_FIELD_LABELS[k]).join(", "),
  });
  if (user.organizationId) {
    await notifyOrgManagers(
      user.organizationId,
      `Demande de modification – ${user.name}`,
      `Champs concernés : ${Object.keys(changes).map((k) => PROFILE_FIELD_LABELS[k]).join(", ")}.`,
      `/of/accounts/${user.id}`,
    );
  }
  revalidateProfile(user.id);
  return { ok: "Demande envoyée : votre organisme va l'examiner." };
}

export async function cancelProfileChangeAction(requestId: string) {
  const user = await requireUser();
  const req = await db.profileChangeRequest.findUnique({ where: { id: requestId }, select: { userId: true, status: true } });
  if (!req || req.userId !== user.id || req.status !== "PENDING") throw new Error("Demande introuvable");
  await db.profileChangeRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } });
  revalidateProfile(user.id);
}

async function loadRequestForStaff(requestId: string) {
  const staff = await requireOfManager();
  const req = await db.profileChangeRequest.findUnique({
    where: { id: requestId },
    include: { user: { select: { id: true, name: true, organizationId: true, role: true } } },
  });
  if (!req || req.user.role !== "LEARNER" || !canManageOrg(staff, req.user.organizationId)) throw new Error("Demande introuvable");
  if (req.status !== "PENDING") throw new Error("Cette demande a déjà été traitée");
  return { staff, req };
}

/** L'OF accepte : les nouvelles valeurs sont appliquées au profil et tracées dans le journal d'audit. */
export async function approveProfileChangeAction(requestId: string, _: ProfileState, fd: FormData): Promise<ProfileState> {
  const { staff, req } = await loadRequestForStaff(requestId);
  const changes = req.changes as Changes;
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(changes)) {
    if (!(k in PROFILE_FIELD_LABELS)) continue;
    data[k] = k === "birthDate" ? (v.to ? new Date(String(v.to)) : null) : k === "employmentStatus" ? ((v.to as EmploymentStatus | null) ?? null) : v.to;
  }
  const profile = await db.learnerProfile.upsert({
    where: { userId: req.userId },
    create: { ...(data as Omit<Prisma.LearnerProfileUncheckedCreateInput, "userId">), userId: req.userId },
    update: data as Prisma.LearnerProfileUpdateInput,
  });
  if (profile.firstName && profile.lastName) {
    await db.user.update({ where: { id: req.userId }, data: { name: `${profile.firstName} ${profile.lastName}`, phone: profile.phone } });
  }
  const note = str(fd, "note").slice(0, 1000) || null;
  await db.profileChangeRequest.update({ where: { id: requestId }, data: { status: "APPROVED", reviewedById: staff.id, reviewedAt: new Date(), reviewNote: note } });
  await audit("profile.change_approve", {
    actorId: staff.id,
    organizationId: req.user.organizationId,
    entityType: "User",
    entityId: req.userId,
    details: Object.fromEntries(Object.entries(changes).map(([k, v]) => [PROFILE_FIELD_LABELS[k] ?? k, `${v.from ?? "—"} → ${v.to ?? "—"}`])),
  });
  await notify(req.userId, "Modification de vos informations acceptée", note ?? "Votre organisme a mis à jour vos informations.", "/profile");
  revalidateProfile(req.userId);
  return { ok: "Modification appliquée au profil de l'apprenant." };
}

export async function rejectProfileChangeAction(requestId: string, _: ProfileState, fd: FormData): Promise<ProfileState> {
  const { staff, req } = await loadRequestForStaff(requestId);
  const note = str(fd, "note").slice(0, 1000);
  if (note.length < 5) return { error: "Indiquez le motif du refus (visible par l'apprenant)." };
  await db.profileChangeRequest.update({ where: { id: requestId }, data: { status: "REJECTED", reviewedById: staff.id, reviewedAt: new Date(), reviewNote: note } });
  await audit("profile.change_reject", { actorId: staff.id, organizationId: req.user.organizationId, entityType: "User", entityId: req.userId, details: note });
  await notify(req.userId, "Modification de vos informations refusée", note, "/profile");
  revalidateProfile(req.userId);
  return { ok: "Demande refusée : l'apprenant a été notifié." };
}
