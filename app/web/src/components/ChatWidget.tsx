"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Msg = { id: number | string; role: "user" | "assistant"; content: string; cta?: string | null };

// AIが返す [CTA: <action>] を画面内リンクに対応づける
function ctaLink(cta: string): { href: string; label: string } | null {
  const [action, arg] = cta.split(":");
  switch (action) {
    case "open_maintenance_booking": return { href: "/maintenance", label: "整備を予約する" };
    case "open_system_request":      return { href: "/system", label: "開発を依頼する" };
    case "open_subscription_settings": return { href: "/subscriptions", label: "サブスク設定へ" };
    case "view_order":               return arg ? { href: `/orders/${arg}`, label: `注文 #${arg} を見る` } : null;
    case "view_requests":            return { href: "/requests", label: "依頼状況を見る" };
    default: return null;
  }
}

export function ChatWidget() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function ensureConversation() {
    if (conversationId) return conversationId;
    const c = await api<{ id: number }>("/ai_concierge/conversations", { method: "POST", auth: token });
    setConversationId(c.id);
    return c.id;
  }

  async function send() {
    if (!input.trim() || busy) return;
    const text = input;
    setInput("");
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: text }]);
    setBusy(true);
    try {
      const cid = await ensureConversation();
      const reply = await api<Msg>(`/ai_concierge/conversations/${cid}/messages`, {
        method: "POST",
        body: jsonBody({ content: text }),
        auth: token,
      });
      setMessages((m) => [...m, reply]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "エラーが発生しました";
      setMessages((m) => [...m, { id: `err-${Date.now()}`, role: "assistant", content: `(${msg})` }]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [messages]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 grid place-items-center rounded-full bg-caramel text-white w-14 h-14 z-50 text-xl font-bold shadow-lift transition-transform hover:scale-105 active:scale-95"
        aria-label="AIコンシェルジュ"
        title="AIコンシェルジュ"
      >
        {open ? "×" : "R&R"}
      </button>
      {open && (
        <div className="fixed bottom-24 right-5 w-[22rem] max-w-[calc(100vw-2.5rem)] h-[30rem] bg-white border border-coffee-200 rounded-2xl shadow-lift flex flex-col z-50 overflow-hidden animate-in">
          <div className="px-4 py-3 bg-espresso text-coffee-50 flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-caramel" />
            <div>
              <div className="font-semibold text-sm leading-tight tracking-wide">AIコンシェルジュ</div>
              <div className="text-[11px] text-coffee-400">豆・パーツ・整備・ナビのご相談</div>
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-2.5 text-sm bg-coffee-50/40">
            {messages.length === 0 && (
              <p className="text-coffee-500 text-center mt-8 px-4 leading-relaxed">
                商品の質問や注文状況など、<br />お気軽にどうぞ。
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <span
                  className={`inline-block px-3.5 py-2 max-w-[85%] text-sm leading-relaxed shadow-soft ${
                    m.role === "user"
                      ? "bg-espresso text-coffee-50 rounded-2xl rounded-br-md"
                      : "bg-white text-coffee-800 rounded-2xl rounded-bl-md border border-coffee-100"
                  }`}
                >
                  {m.content}
                  {m.cta && (() => {
                    const link = ctaLink(m.cta);
                    return link ? (
                      <Link
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="mt-1.5 inline-flex text-xs font-semibold text-caramel hover:underline"
                      >
                        {link.label} →
                      </Link>
                    ) : (
                      <div className="text-xs mt-1 opacity-70">→ {m.cta}</div>
                    );
                  })()}
                </span>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <span className="inline-flex gap-1 bg-white border border-coffee-100 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-coffee-300 animate-pulse-soft" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-coffee-300 animate-pulse-soft" style={{ animationDelay: "200ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-coffee-300 animate-pulse-soft" style={{ animationDelay: "400ms" }} />
                </span>
              </div>
            )}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="border-t border-coffee-200/70 p-2.5 flex gap-2 bg-white"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="メッセージを入力…"
              className="input !rounded-full !py-2"
            />
            <button
              type="submit"
              disabled={busy}
              className="btn btn-accent !rounded-full !px-4 shrink-0"
            >
              送信
            </button>
          </form>
        </div>
      )}
    </>
  );
}
