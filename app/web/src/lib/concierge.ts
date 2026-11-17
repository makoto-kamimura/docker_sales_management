"use client";

// AIコンシェルジュ (Claude)。API が Claude を呼び、会話履歴は API 側に残る。
// API キーが未設定なら settings が enabled: false を返すので、チャットを画面に出さない

import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";

export type ConciergeMessage = { id: number | string; role: "user" | "assistant"; content: string; cta?: string | null };
export type ConciergeSettings = { enabled: boolean; max_content_length: number };
/** 続きから話せるよう、タブを閉じるまで覚えておく会話。owner が変わったら (ログイン・ログアウト) 使わない */
export type ConciergeSession = { owner: string; id: number; guest_token: string | null };

const STORAGE_KEY = "cf_concierge";

export function useConciergeSettings(): ConciergeSettings | undefined {
  const { data } = useSWR("ai-concierge-settings", () => api<ConciergeSettings>("/ai_concierge/settings"), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  return data;
}

export function readSession(owner: string): ConciergeSession | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as ConciergeSession | null;
    return s && s.owner === owner && typeof s.id === "number" ? s : null;
  } catch {
    return null;
  }
}

export function writeSession(session: ConciergeSession | null) {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 保存できなくても会話は続けられる */
  }
}

export async function startConversation(owner: string, token: string | null): Promise<ConciergeSession> {
  const c = await api<{ id: number; guest_token: string | null }>("/ai_concierge/conversations", { method: "POST", auth: token });
  return { owner, id: c.id, guest_token: c.guest_token };
}

export async function fetchMessages(session: ConciergeSession, token: string | null) {
  const q = session.guest_token ? `?guest_token=${encodeURIComponent(session.guest_token)}` : "";
  const c = await api<{ messages: ConciergeMessage[] }>(`/ai_concierge/conversations/${session.id}${q}`, { auth: token });
  return c.messages;
}

export function postMessage(session: ConciergeSession, content: string, token: string | null) {
  return api<ConciergeMessage>(`/ai_concierge/conversations/${session.id}/messages`, {
    method: "POST",
    body: jsonBody({ content, guest_token: session.guest_token ?? undefined }),
    auth: token,
  });
}

/** 応答に付く CTA (API が切り出した action) を、画面内のリンクにする。知らないものは出さない */
export function ctaLink(cta: string): { href: string; label: string } | null {
  const [action, arg] = cta.split(":");
  switch (action) {
    case "open_custom_request":        return { href: "/custom", label: "オーダーメイドを依頼する" };
    case "open_contact":               return { href: "/contact", label: "問い合わせる" };
    case "human_handoff":              return { href: "/contact", label: "スタッフに問い合わせる" };
    case "open_subscription_settings": return { href: "/subscriptions", label: "サブスクの設定を開く" };
    case "view_requests":              return { href: "/requests", label: "問い合わせ・依頼を見る" };
    case "view_order":                 return arg ? { href: `/orders/${arg}`, label: `注文 #${arg} を見る` } : null;
    case "view_product":               return arg ? { href: `/products/${arg}`, label: "商品ページを見る" } : null;
    default:                           return null;
  }
}

/** 最初に出す質問の例。休止中のオーダーメイドは出さない */
export function suggestions(loggedIn: boolean, customOrders: boolean): string[] {
  return [
    loggedIn ? "注文の状況を知りたい" : "どんな作品がありますか？",
    customOrders ? "オーダーメイドを相談したい" : "3Dデータの受け取り方は？",
    "支払い方法と送料は？",
  ];
}
