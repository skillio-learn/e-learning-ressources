"use client";
import { MessageCircle } from "lucide-react";

/** Ouvre le chat d'assistance flottant. */
export function OpenSupportButton({ label = "Ouvrir le chat d'assistance", className = "btn-primary" }: { label?: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("vylia:open-support"))}>
      <MessageCircle className="h-4 w-4" /> {label}
    </button>
  );
}
