import type { LearnerProfile } from "@prisma/client";
import type { ProfileData } from "@/components/applications/ProfileForm";

export function toProfileData(p: LearnerProfile | null): ProfileData | null {
  if (!p) return null;
  return { ...p, birthDate: p.birthDate ? p.birthDate.toISOString().slice(0, 10) : null };
}
