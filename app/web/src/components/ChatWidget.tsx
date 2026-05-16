"use client";

import { useEffect, useRef, useState } from "react";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Msg = { id: number | string; role: "user" | "assistant"; content: string; cta?: string | null };

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
        className="fixed bottom-5 right-5 rounded-full bg-caramel hover:bg-coffee-500 text-white w-14 h-14 shadow-lg z-50 text-xl transition-colors"
        aria-label="AI接客"
        title="AI接客チャット"
      >
        ☕
      </button>
      {open && (
        <div className="fixed bottom-24 right-5 w-80 h-[28rem] bg-cream border border-coffee-200 rounded-xl shadow-xl flex flex-col z-50">
          <div className="px-3 py-2 border-b border-coffee-200 font-semibold bg-espresso text-coffee-50 rounded-t-xl">
            AI接客
          </div>
          <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-2 text-sm">
            {messages.length === 0 && (
              <p className="text-coffee-500">商品の質問や注文状況など、お気軽にどうぞ。</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
                <span
                  className={`inline-block px-3 py-2 rounded-2xl max-w-[85%] ${
                    m.role === "user"
                      ? "bg-espresso text-coffee-50"
                      : "bg-foam text-coffee-800"
                  }`}
                >
                  {m.content}
                  {m.cta && (
                    <div className="text-xs mt-1 opacity-70">→ {m.cta}</div>
                  )}
                </span>
              </div>
            ))}
            {busy && <div className="text-coffee-400 text-xs">考え中…</div>}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="border-t border-coffee-200 p-2 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="メッセージ"
              className="flex-1 rounded border border-coffee-200 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-caramel hover:bg-coffee-500 text-white px-3 text-sm disabled:opacity-50 transition-colors"
            >
              送信
            </button>
          </form>
        </div>
      )}
    </>
  );
}
