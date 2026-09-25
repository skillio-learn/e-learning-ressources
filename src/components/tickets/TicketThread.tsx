import { FileText, Lock } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

type Msg = {
  id: string;
  body: string;
  fromAdmin: boolean;
  internal: boolean;
  system: boolean;
  fileName: string | null;
  size: number | null;
  readAt: Date | null;
  createdAt: Date;
  author: { name: string } | null;
};

/** Fil d'un ticket. « viewer » détermine le côté aligné à droite et masque les notes internes pour l'OF. */
export function TicketThread({ messages, viewer }: { messages: Msg[]; viewer: "admin" | "of" }) {
  const visible = viewer === "admin" ? messages : messages.filter((m) => !m.internal);
  return (
    <div className="space-y-3">
      {visible.map((m) => {
        if (m.system) {
          return (
            <div key={m.id} className="mx-auto max-w-[85%] rounded-2xl bg-white px-3 py-2 text-center text-xs text-slate-500">
              {m.body} <span className="text-slate-500">· {formatDate(m.createdAt, true)}</span>
            </div>
          );
        }
        const mine = viewer === "admin" ? m.fromAdmin : !m.fromAdmin;
        return (
          <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-[20px] px-4 py-2.5 text-sm",
                m.internal
                  ? "rounded-br-md bg-amber-50 text-slate-900 ring-1 ring-inset ring-amber-200"
                  : mine
                    ? "rounded-br-md bg-brand-600 text-white"
                    : "rounded-bl-md bg-white text-slate-900",
              )}
            >
              <div className={cn("mb-0.5 flex items-center gap-1 text-[11px] font-medium", mine && !m.internal ? "text-white/75" : "text-slate-500")}>
                {m.internal && <Lock className="h-3 w-3" strokeWidth={2} />}
                {m.author?.name ?? "—"}
                {m.fromAdmin && !m.internal ? " · Support Vylia" : ""}
                {m.internal ? " · note interne" : ""}
              </div>
              <div className="whitespace-pre-line break-words">{m.body}</div>
              {m.fileName && (
                <a
                  href={`/api/tickets/attachments/${m.id}`}
                  className={cn(
                    "mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs",
                    mine && !m.internal ? "bg-white/15 text-white hover:bg-white/25" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  )}
                >
                  <FileText className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{m.fileName}</span>
                  {m.size ? <span className="shrink-0 opacity-70">{Math.max(1, Math.round(m.size / 1024))} Ko</span> : null}
                </a>
              )}
              <div className={cn("mt-0.5 text-right text-[10px]", mine && !m.internal ? "text-white/70" : "text-slate-500")}>
                {formatDate(m.createdAt, true)}
                {mine && !m.internal && m.readAt ? " · lu" : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
