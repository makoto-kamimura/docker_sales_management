"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useStorefront } from "@/lib/useStorefront";
import {
  type ConciergeMessage, type ConciergeSession,
  ctaLink, fetchMessages, postMessage, readSession, startConversation, suggestions, useConciergeSettings, writeSession,
} from "@/lib/concierge";

/** コンシェルジュベル (ホテルの受付にある呼び鈴) */
function ConciergeBell({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
         strokeLinejoin="round" aria-hidden className={className}>
      <circle cx="12" cy="5.5" r="1.3" fill="currentColor" stroke="none" />
      <path d="M12 7v2" />
      <path d="M4 17a8 8 0 0 1 16 0" />
      <path d="M3 17h18" />
      <path d="M2.5 20.5h19" />
    </svg>
  );
}

/** 送れなかった発話。文言を出し、同じ内容を送り直せるようにする */
type Failure = { text: string; message: string };

export function ChatWidget() {
  const { user, token, loading } = useAuth();
  const settings = useConciergeSettings();
  const storefront = useStorefront();
  const pathname = usePathname();
  const owner = user ? `user-${user.id}` : "guest";

  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<ConciergeSession | null>(null);
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoredFor = useRef<string | null>(null);
  const tokenRef = useRef(token); // 履歴の復元を、トークンの更新でやり直さないため
  tokenRef.current = token;

  const reset = useCallback(() => {
    writeSession(null);
    setSession(null);
    setMessages([]);
    setFailure(null);
  }, []);

  // 開いたとき、このタブで続けていた会話があれば履歴を戻す。ログイン・ログアウトで持ち主が変わったら新しく始める
  useEffect(() => {
    if (!open || loading || restoredFor.current === owner) return;
    restoredFor.current = owner;
    setSession(null);
    setMessages([]);
    setFailure(null);
    const stored = readSession(owner);
    if (!stored) return;
    let cancelled = false;
    fetchMessages(stored, tokenRef.current)
      .then((history) => {
        if (cancelled) return;
        setSession(stored);
        setMessages(history);
      })
      .catch(() => writeSession(null)); // 会話が見つからなければ、次の発話で作り直す
    return () => { cancelled = true; };
  }, [open, loading, owner]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, failure]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function deliver(text: string) {
    setBusy(true);
    setFailure(null);
    try {
      let current = session ?? (await startConversation(owner, token));
      let reply: ConciergeMessage;
      try {
        reply = await postMessage(current, text, token);
      } catch (e) {
        // 会話が見つからない (期限切れなど) ときは、新しい会話で 1 回だけ送り直す
        if (!(e instanceof ApiError && e.status === 404)) throw e;
        current = await startConversation(owner, token);
        reply = await postMessage(current, text, token);
      }
      setSession(current);
      writeSession(current);
      setMessages((m) => [...m, reply]);
    } catch (e) {
      setFailure({ text, message: e instanceof Error && e.message ? e.message : "送信できませんでした。" });
    } finally {
      setBusy(false);
    }
  }

  function send(raw: string) {
    const text = raw.trim();
    if (!text || busy || loading) return;
    setInput("");
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: text }]);
    void deliver(text);
  }

  // 未設定なら出さない。管理画面は店舗スタッフ向けなので出さない
  if (!settings?.enabled || pathname?.startsWith("/admin")) return null;

  const maxLength = settings.max_content_length;

  return (
    <>
      {/* 狭い画面はベルのみ (AI バッジつき)、広い画面は「AIコンシェルジュ」の文字も出す */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 inline-flex h-14 items-center gap-2 rounded-full bg-caramel px-4 text-white shadow-lift transition-transform hover:scale-105 active:scale-95 sm:pr-5"
        aria-label={open ? "AIコンシェルジュを閉じる" : "AIコンシェルジュに相談する"}
        aria-expanded={open}
        title="AIコンシェルジュ"
      >
        {open ? (
          <span aria-hidden className="w-6 text-center text-2xl leading-none">×</span>
        ) : (
          <span className="relative">
            <ConciergeBell className="h-6 w-6" />
            <span aria-hidden className="absolute -right-2.5 -top-2 rounded-full bg-espresso px-1 text-[9px] font-bold leading-[14px] text-coffee-50 ring-2 ring-caramel sm:hidden">
              AI
            </span>
          </span>
        )}
        <span className="hidden whitespace-nowrap text-sm font-bold sm:inline">{open ? "閉じる" : "AIコンシェルジュ"}</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="AIコンシェルジュ"
          className="fixed bottom-24 right-5 z-50 flex h-[32rem] max-h-[calc(100dvh-7.5rem)] w-[23rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-coffee-200 bg-white shadow-lift animate-in"
        >
          <div className="flex items-center gap-2.5 bg-espresso px-4 py-3 text-coffee-50">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-caramel text-white">
              <ConciergeBell className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-tight tracking-wide">AIコンシェルジュ</div>
              <div className="text-[11px] text-coffee-400">作品探し・ご注文についてのご相談</div>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="shrink-0 rounded-full border border-coffee-600 px-2.5 py-1 text-[11px] font-semibold text-coffee-200 transition-colors hover:border-coffee-300 hover:text-white disabled:opacity-40"
              >
                新しい会話
              </button>
            )}
          </div>

          <div ref={scrollRef} role="log" aria-live="polite" className="flex-1 space-y-2.5 overflow-auto bg-coffee-50/40 p-3 text-sm">
            {messages.length === 0 && (
              <div className="px-2 pt-6 text-center">
                <p className="leading-relaxed text-coffee-600">
                  {user ? `${user.name} さん、こんにちは。` : "こんにちは。"}
                  <br />
                  作品探しや、ご注文・お支払いについてのご質問にお答えします。
                </p>
                <div className="mt-4 flex flex-col items-stretch gap-2">
                  {suggestions(!!user, storefront?.custom_orders ?? false).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      disabled={busy}
                      className="rounded-full border border-coffee-200 bg-white px-3.5 py-2 text-[13px] text-coffee-700 transition-colors hover:border-caramel hover:text-caramel disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => {
              const link = m.cta ? ctaLink(m.cta) : null;
              return (
                <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-relaxed shadow-soft ${
                      m.role === "user"
                        ? "rounded-2xl rounded-br-md bg-espresso text-coffee-50"
                        : "rounded-2xl rounded-bl-md border border-coffee-100 bg-white text-coffee-800"
                    }`}
                  >
                    {m.content}
                  </div>
                  {link && (
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-caramel px-3 py-1.5 text-xs font-semibold text-caramel transition-colors hover:bg-caramel hover:text-white"
                    >
                      {link.label} <span aria-hidden>→</span>
                    </Link>
                  )}
                </div>
              );
            })}
            {busy && (
              <div className="flex justify-start" aria-label="応答を作成しています">
                <span className="inline-flex gap-1 rounded-2xl rounded-bl-md border border-coffee-100 bg-white px-3.5 py-2.5 shadow-soft">
                  {[0, 200, 400].map((delay) => (
                    <span key={delay} className="h-1.5 w-1.5 rounded-full bg-coffee-300 animate-pulse-soft" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </span>
              </div>
            )}
            {failure && !busy && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
                {failure.message}
                <button type="button" onClick={() => void deliver(failure.text)} className="ml-2 font-semibold underline underline-offset-2">
                  もう一度送る
                </button>
              </div>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-coffee-200/70 bg-white p-2.5">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={maxLength}
                placeholder="メッセージを入力…"
                aria-label="メッセージ"
                enterKeyHint="send"
                className="input !rounded-full !py-2"
              />
              <button type="submit" disabled={busy || !input.trim()} className="btn btn-accent shrink-0 !rounded-full !px-4">
                送信
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[10px] leading-snug text-coffee-400">
              AI の回答です。価格・在庫・納期は商品ページと注文詳細でご確認ください。
            </p>
          </form>
        </div>
      )}
    </>
  );
}
