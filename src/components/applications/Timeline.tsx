import type { ApplicationEventType, ApplicationStatus } from "@prisma/client";
import { APPLICATION_STATUS } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";

type Ev = {
  id: string;
  type: ApplicationEventType;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus | null;
  message: string | null;
  createdAt: Date;
  author: { name: string; role: string } | null;
};

export function Timeline({ events, learnerId, showInternal }: { events: Ev[]; learnerId: string; showInternal: boolean }) {
  const list = events.filter((e) => showInternal || e.type !== "NOTE");
  if (!list.length) return <p className="text-sm text-slate-500">Aucun évènement.</p>;
  return (
    <ol className="space-y-3">
      {list.map((e) => {
        const mine = e.author && (e.author.role === "LEARNER");
        return (
          <li
            key={e.id}
            className={cn(
              "rounded-lg border p-3 text-sm",
              e.type === "NOTE" && "border-amber-200 bg-amber-50",
              e.type === "MESSAGE" && (mine ? "border-slate-200 bg-white" : "border-brand-200 bg-brand-50"),
              e.type === "STATUS" && "border-slate-200 bg-slate-50",
              e.type === "DOCUMENT" && "border-slate-100 bg-white",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                {e.type === "STATUS" && "🔄 Statut"}
                {e.type === "MESSAGE" && "💬 Message"}
                {e.type === "NOTE" && "🔒 Note interne OF"}
                {e.type === "DOCUMENT" && "📎 Justificatif"}
                {e.author ? ` · ${e.author.name}${e.author.role === "LEARNER" ? " (apprenant)" : " (organisme)"}` : ""}
              </span>
              <span>{formatDate(e.createdAt, true)}</span>
            </div>
            {e.type === "STATUS" && e.toStatus && (
              <div className="mt-1 font-medium">
                {e.fromStatus ? `${APPLICATION_STATUS[e.fromStatus].label} → ` : ""}
                {APPLICATION_STATUS[e.toStatus].label}
              </div>
            )}
            {e.message && <div className="mt-1 whitespace-pre-wrap text-slate-700">{e.message}</div>}
          </li>
        );
      })}
    </ol>
  );
  void learnerId;
}
