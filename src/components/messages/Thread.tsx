import { cn, formatDate } from "@/lib/utils";

type Msg = { id: string; body: string; fromStaff: boolean; createdAt: Date; readAt: Date | null; author: { name: string } };

export function Thread({ messages, viewer }: { messages: Msg[]; viewer: "learner" | "staff" }) {
  if (!messages.length) return <p className="text-sm text-slate-500">Aucun message pour le moment.</p>;
  return (
    <ol className="space-y-3">
      {messages.map((m) => {
        const mine = (viewer === "staff") === m.fromStaff;
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] rounded-2xl px-4 py-2 text-sm", mine ? "bg-brand-600 text-white" : "bg-white shadow-sm ring-1 ring-slate-200")}>
              <div className={cn("mb-0.5 text-[11px]", mine ? "text-white/70" : "text-slate-400")}>
                {m.author.name}{m.fromStaff ? " (formateur / OF)" : ""} · {formatDate(m.createdAt, true)}
                {mine && m.readAt ? " · lu" : ""}
              </div>
              <div className="whitespace-pre-wrap">{m.body}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
