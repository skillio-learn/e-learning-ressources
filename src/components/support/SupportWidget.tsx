"use client";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2, MessageCircle, Plus, Send, Star, X } from "lucide-react";
import { openSupportConversationAction, rateSupportAction, sendSupportMessageAction, setSupportStatusAction, type SupportState } from "@/app/actions/support";
import { SUPPORT_CATEGORIES, SUPPORT_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Conv = { id: string; subject: string; category: string; status: keyof typeof SUPPORT_STATUS; lastMessageAt: string; rating: number | null; unread: number };
type Msg = { id: string; body: string; fromStaff: boolean; system: boolean; createdAt: string; author: string | null; read: boolean };
type Overview = { team: string; enabled: boolean; hours: string | null; responseHours: number; unread: number; conversations: Conv[] };

const time = (d: string) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Chat d'assistance flottant (apprenants, y compris compte en attente de validation). */
export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "new" | string>("list");
  const [data, setData] = useState<Overview | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const r = await fetch("/api/support/conversations", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {}
  }, []);

  // Badge : rafraîchi toutes les 30 s quand l'onglet est visible
  useEffect(() => {
    loadOverview();
    const t = setInterval(() => document.visibilityState === "visible" && loadOverview(), 30_000);
    const openHandler = () => setOpen(true);
    window.addEventListener("vylia:open-support", openHandler);
    return () => {
      clearInterval(t);
      window.removeEventListener("vylia:open-support", openHandler);
    };
  }, [loadOverview]);

  useEffect(() => {
    if (open) loadOverview();
  }, [open, view, loadOverview]);

  return (
    <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[min(600px,calc(100vh-7rem))] w-[min(390px,calc(100vw-2.5rem))] animate-fade-up flex-col overflow-hidden rounded-[28px] border border-black/[0.06] bg-surface shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)]">
          <header className="flex items-center gap-3 border-b border-black/[0.06] bg-[linear-gradient(135deg,#0071e3,#5e5ce6)] px-5 py-4 text-white">
            {view !== "list" && (
              <button onClick={() => setView("list")} className="-ml-1 rounded-full p-1 transition hover:bg-white/15" aria-label="Retour">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium">Assistance · {data?.team ?? "…"}</div>
              <div className="truncate text-xs text-white/75">
                {data?.hours ? `${data.hours} · ` : ""}Réponse sous {data?.responseHours ?? 24} h ouvrées
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-1 transition hover:bg-white/15" aria-label="Fermer">
              <X className="h-4 w-4" />
            </button>
          </header>
          {view === "list" && <ConversationList data={data} onOpen={setView} />}
          {view === "new" && <NewConversation onCreated={(id) => setView(id)} />}
          {view !== "list" && view !== "new" && <Thread id={view} onChange={loadOverview} />}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-white shadow-[0_12px_30px_-8px_rgba(0,113,227,0.7)] transition hover:scale-105 active:scale-95"
        aria-label="Assistance"
        title="Besoin d'aide ?"
      >
        {open ? <X className="h-6 w-6" strokeWidth={1.75} /> : <MessageCircle className="h-6 w-6" strokeWidth={1.75} />}
        {!open && !!data?.unread && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-semibold ring-2 ring-white">{data.unread}</span>
        )}
      </button>
    </div>
  );
}

function ConversationList({ data, onOpen }: { data: Overview | null; onOpen: (v: string) => void }) {
  if (!data) return <div className="grid flex-1 place-items-center text-sm text-slate-400">Chargement…</div>;
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="p-4">
        <p className="text-sm text-slate-600">Une question sur votre inscription, un problème technique, votre financement ? Écrivez-nous.</p>
        <button onClick={() => onOpen("new")} disabled={!data.enabled} className="btn-primary mt-3 w-full">
          <Plus className="h-4 w-4" /> Nouvelle conversation
        </button>
        {!data.enabled && <p className="mt-2 text-xs text-amber-700">L&apos;assistance en ligne n&apos;est pas activée par votre organisme.</p>}
      </div>
      <ul className="flex-1 divide-y divide-black/[0.05] overflow-y-auto border-t border-black/[0.05]">
        {data.conversations.map((c) => (
          <li key={c.id}>
            <button onClick={() => onOpen(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">{c.subject}</div>
                <div className="text-xs text-slate-500">
                  {SUPPORT_CATEGORIES[c.category]} · {time(c.lastMessageAt)}
                </div>
              </div>
              {c.unread > 0 ? (
                <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">{c.unread}</span>
              ) : (
                <span className={cn("text-[11px]", c.status === "RESOLVED" ? "text-emerald-600" : "text-slate-400")}>{SUPPORT_STATUS[c.status].label}</span>
              )}
            </button>
          </li>
        ))}
        {data.conversations.length === 0 && <li className="p-6 text-center text-sm text-slate-400">Aucune conversation pour le moment.</li>}
      </ul>
    </div>
  );
}

function NewConversation({ onCreated }: { onCreated: (id: string) => void }) {
  const [state, action, pending] = useActionState<SupportState, FormData>(openSupportConversationAction, undefined);
  useEffect(() => {
    if (state?.id) onCreated(state.id);
  }, [state, onCreated]);
  return (
    <form action={action} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      <label className="block">
        <span className="label">Sujet</span>
        <select name="category" required className="input" defaultValue="">
          <option value="" disabled>Choisissez…</option>
          {Object.entries(SUPPORT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">Objet</span>
        <input name="subject" required maxLength={120} className="input" placeholder="En quelques mots" />
      </label>
      <label className="block flex-1">
        <span className="label">Message</span>
        <textarea name="body" required maxLength={4000} rows={6} className="input h-full min-h-[140px]" placeholder="Décrivez votre demande…" />
      </label>
      {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Envoi…" : "Envoyer"}</button>
    </form>
  );
}

function Thread({ id, onChange }: { id: string; onChange: () => void }) {
  const [conv, setConv] = useState<{ subject: string; status: keyof typeof SUPPORT_STATUS; rating: number | null } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/support/conversations/${id}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setConv(d.conversation);
      setMessages(d.messages);
    } catch {}
  }, [id]);

  // Rafraîchissement toutes les 4 s tant que la conversation est ouverte
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (messages.length !== count.current) {
      count.current = messages.length;
      bottom.current?.scrollIntoView({ behavior: "smooth" });
      onChange();
    }
  }, [messages, onChange]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    start(async () => {
      const fd = new FormData();
      fd.set("body", body);
      const res = await sendSupportMessageAction(id, undefined, fd);
      if (res?.error) setError(res.error);
      else {
        setError(null);
        setText("");
        await load();
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.05] px-4 py-2.5">
        <div className="truncate text-sm font-medium text-slate-900">{conv?.subject ?? "…"}</div>
        {conv && conv.status !== "RESOLVED" && (
          <button
            onClick={() => start(async () => { await setSupportStatusAction(id, "RESOLVED"); await load(); })}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-700 hover:underline"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Résolu
          </button>
        )}
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto bg-slate-50/60 px-4 py-4">
        {messages.map((m) =>
          m.system ? (
            <div key={m.id} className="mx-auto max-w-[90%] rounded-2xl bg-white px-3 py-2 text-center text-xs text-slate-500 shadow-sm">{m.body}</div>
          ) : (
            <div key={m.id} className={cn("flex", m.fromStaff ? "justify-start" : "justify-end")}>
              <div className={cn("max-w-[82%] rounded-[20px] px-3.5 py-2 text-sm", m.fromStaff ? "rounded-bl-md bg-white text-slate-900 shadow-sm" : "rounded-br-md bg-brand-600 text-white")}>
                {m.fromStaff && m.author && <div className="mb-0.5 text-[11px] font-medium text-slate-500">{m.author}</div>}
                <div className="whitespace-pre-line break-words">{m.body}</div>
                <div className={cn("mt-0.5 text-right text-[10px]", m.fromStaff ? "text-slate-400" : "text-white/70")}>
                  {time(m.createdAt)}{!m.fromStaff && m.read ? " · lu" : ""}
                </div>
              </div>
            </div>
          ),
        )}
        {conv?.status === "RESOLVED" && (
          <div className="rounded-2xl bg-white p-3 text-center text-xs text-slate-600 shadow-sm">
            <div>Votre avis sur cette assistance :</div>
            <div className="mt-1 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} aria-label={`${n} sur 5`} onClick={() => start(async () => { await rateSupportAction(id, n); await load(); })}>
                  <Star className={cn("h-5 w-5", (conv.rating ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <div className="border-t border-black/[0.05] p-3">
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={conv?.status === "RESOLVED" ? "Écrire pour rouvrir la conversation…" : "Votre message…"}
            className="input max-h-32 min-h-[42px] flex-1 resize-none py-2.5"
            aria-label="Votre message"
          />
          <button onClick={send} disabled={pending || !text.trim()} className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-brand-600 text-white transition disabled:opacity-40" aria-label="Envoyer">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
