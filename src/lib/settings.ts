import "server-only";
import { cache } from "react";
import { db } from "./db";

export const DEFAULT_SETTINGS = {
  platformName: "Skillio Academy",
  tagline: "Des formations interactives, étape par étape.",
  allowRegistration: "true",
  supportEmail: "",
  certificateSignature: "L'équipe pédagogique",
};

export type Settings = typeof DEFAULT_SETTINGS;

export const getSettings = cache(async (): Promise<Settings> => {
  try {
    const rows = await db.setting.findMany();
    const s = { ...DEFAULT_SETTINGS };
    for (const r of rows) if (r.key in s) (s as Record<string, string>)[r.key] = r.value;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
});
