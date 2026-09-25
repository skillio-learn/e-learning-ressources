import type { EmploymentStatus, LearnerProfile } from "@prisma/client";
import type { ProfileData } from "@/components/applications/ProfileForm";
import { EMPLOYMENT_STATUS, PROFILE_FIELD_LABELS } from "@/lib/labels";

export function toProfileData(p: LearnerProfile | null): ProfileData | null {
  if (!p) return null;
  return { ...p, birthDate: p.birthDate ? p.birthDate.toISOString().slice(0, 10) : null };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const o = (fd: FormData, k: string) => s(fd, k) || null;

export type ProfileValues = {
  civility: string | null; firstName: string | null; lastName: string | null; birthName: string | null; birthDate: Date | null;
  birthPlace: string | null; nationality: string | null; address: string | null; postalCode: string | null; city: string | null;
  country: string | null; phone: string | null; employmentStatus: EmploymentStatus | null; franceTravailId: string | null;
  franceTravailAgency: string | null; educationLevel: string | null; lastDiploma: string | null; currentJob: string | null;
  employerName: string | null; employerSiret: string | null; employerAddress: string | null; employerContactName: string | null;
  employerContactEmail: string | null; employerContactPhone: string | null; opcoName: string | null; disability: boolean;
  disabilityNeeds: string | null;
};

/** Lecture et validation du formulaire de profil (saisie initiale, demande de modification). */
export function parseProfileForm(fd: FormData): { error: string } | { data: ProfileValues } {
  const postalCode = s(fd, "postalCode");
  if (postalCode && !/^\d{5}$/.test(postalCode) && (s(fd, "country") || "France") === "France") return { error: "Code postal invalide (5 chiffres)." };
  const phone = s(fd, "phone");
  if (phone && !/^[+\d][\d\s.-]{8,}$/.test(phone)) return { error: "Numéro de téléphone invalide." };
  const siret = s(fd, "employerSiret").replace(/\s/g, "");
  if (siret && !/^\d{14}$/.test(siret)) return { error: "Le SIRET doit comporter 14 chiffres." };
  const bd = s(fd, "birthDate");
  const birthDate = bd ? new Date(bd) : null;
  if (birthDate) {
    if (Number.isNaN(birthDate.getTime())) return { error: "Date de naissance invalide." };
    const age = (Date.now() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age < 15 || age > 100) return { error: "Date de naissance invalide." };
  }
  const es = s(fd, "employmentStatus");
  if (es && !(es in EMPLOYMENT_STATUS)) return { error: "Situation professionnelle invalide." };
  const email = s(fd, "employerContactEmail");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Email du contact employeur invalide." };
  const civility = s(fd, "civility");
  if (civility && !["M.", "Mme"].includes(civility)) return { error: "Civilité invalide." };
  const disability = fd.get("disability") === "on" || fd.get("disability") === "true";
  const cut = (v: string | null, n = 200) => (v ? v.slice(0, n) : v);
  return {
    data: {
      civility: civility || null,
      firstName: cut(o(fd, "firstName"), 80),
      lastName: cut(o(fd, "lastName")?.toUpperCase() ?? null, 80),
      birthName: cut(o(fd, "birthName"), 80),
      birthDate,
      birthPlace: cut(o(fd, "birthPlace")),
      nationality: cut(o(fd, "nationality"), 80),
      address: cut(o(fd, "address")),
      postalCode: postalCode || null,
      city: cut(o(fd, "city"), 100),
      country: cut(o(fd, "country"), 80) ?? "France",
      phone: phone || null,
      employmentStatus: (es || null) as EmploymentStatus | null,
      franceTravailId: cut(o(fd, "franceTravailId"), 40),
      franceTravailAgency: cut(o(fd, "franceTravailAgency")),
      educationLevel: cut(o(fd, "educationLevel"), 120),
      lastDiploma: cut(o(fd, "lastDiploma")),
      currentJob: cut(o(fd, "currentJob")),
      employerName: cut(o(fd, "employerName")),
      employerSiret: siret || null,
      employerAddress: cut(o(fd, "employerAddress")),
      employerContactName: cut(o(fd, "employerContactName"), 120),
      employerContactEmail: email || null,
      employerContactPhone: cut(o(fd, "employerContactPhone"), 40),
      opcoName: cut(o(fd, "opcoName"), 120),
      disability,
      disabilityNeeds: disability ? cut(o(fd, "disabilityNeeds"), 2000) : null,
    },
  };
}

/** Valeur lisible d'un champ du profil (diff des demandes de modification). */
export function displayProfileValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (field === "disability") return v ? "Oui" : "Non";
  if (field === "employmentStatus") return EMPLOYMENT_STATUS[v as keyof typeof EMPLOYMENT_STATUS] ?? String(v);
  if (field === "birthDate") return new Date(String(v)).toLocaleDateString("fr-FR", { timeZone: "UTC" });
  return String(v);
}

/** Différences entre le profil actuel et les valeurs demandées (JSON sérialisable). */
export function profileDiff(current: Partial<LearnerProfile> | null, next: ProfileValues) {
  const norm = (k: string, v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : k === "disability" ? !!v : v ?? null);
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(PROFILE_FIELD_LABELS)) {
    const a = norm(k, (current as Record<string, unknown> | null)?.[k]);
    const b = norm(k, (next as Record<string, unknown>)[k]);
    if (a !== b) out[k] = { from: a, to: b };
  }
  return out;
}
