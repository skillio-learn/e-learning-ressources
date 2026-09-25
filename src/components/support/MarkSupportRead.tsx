"use client";
import { useEffect } from "react";
import { markSupportReadAction } from "@/app/actions/support";

/** Marque la conversation comme lue par une action explicite (POST) une fois la page affichée, jamais pendant le rendu d'un GET. */
export function MarkSupportRead({ conversationId, unread }: { conversationId: string; unread: number }) {
  useEffect(() => {
    if (unread > 0) markSupportReadAction(conversationId).catch(() => {});
  }, [conversationId, unread]);
  return null;
}
