"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * - Avertit avant de quitter la page si le formulaire contient des modifications non enregistrées.
 * - Passe à l'étape suivante après un enregistrement réussi.
 */
export function useFormFlow(ok: string | undefined, nextHref?: string) {
  const dirty = useRef(false);
  const router = useRouter();
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);
  useEffect(() => {
    if (ok) {
      dirty.current = false;
      if (nextHref) router.push(nextHref);
    }
  }, [ok, nextHref, router]);
  return { onChange: () => (dirty.current = true) };
}
