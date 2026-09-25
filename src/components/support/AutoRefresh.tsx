"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Rafraîchit la page serveur à intervalle régulier (onglet visible uniquement). */
export function AutoRefresh({ ms = 8000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), ms);
    return () => clearInterval(t);
  }, [ms, router]);
  return null;
}
