"use client";

// AIコンシェルジュ (Claude)。API が Claude を呼び、会話履歴は API 側に残る。
// API キーが未設定なら settings が enabled: false を返すので、チャットを画面に出さない

import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";

/** AIコンシェルジュが提示したオーダーメイドの下書き (制作依頼書)。依頼にしたら service_request_id が入る */
export type OrderDraft = { title: string; markdown: string; service_request_id: number | null };
export type ConciergeMessage = {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  cta?: string | null;
  order_draft?: OrderDraft | null;
};
export type ConciergeSettings = { enabled: boolean; max_content_length: number };
/** 続きから話せるよう、タブを閉じるまで覚えておく会話。owner が変わったら (ログイン・ログアウト) 使わない */
export type ConciergeSession = { owner: string; id: number; guest_token: string | null };

const STORAGE_KEY = "cf_concierge";
const PENDING_ORDER_KEY = "cf_concierge_order";
/** 確認カードを出す応答の CTA (API が付ける) */
export const CONFIRM_ORDER_CTA = "confirm_custom_order";
/** 「はい」で依頼したときに、API が会話に残す発話 (画面にも同じ文を出す) */
export const ACCEPT_ORDER_TEXT = "はい、この内容でオーダーします";
/** 「修正する」で送る発話 */
export const REVISE_ORDER_TEXT = "内容を修正したいです";
/** 外からチャットを開く (「AIコンシェルジュを通してオーダーする」など) ときのイベント */
const OPEN_EVENT = "cf:concierge-open";
export type OpenConciergeDetail = { starter?: string };

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

/** ゲストが「はい」を押した下書き。ログインしたら、この内容で依頼できるようにする (タブを閉じるまで) */
export type PendingOrder = { conversation_id: number; guest_token: string; message_id: number; title: string; markdown: string };

export function readPendingOrder(): PendingOrder | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_ORDER_KEY) ?? "null") as PendingOrder | null;
    return p && typeof p.conversation_id === "number" && typeof p.message_id === "number" ? p : null;
  } catch {
    return null;
  }
}

export function writePendingOrder(order: PendingOrder | null) {
  try {
    if (order) sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(order));
    else sessionStorage.removeItem(PENDING_ORDER_KEY);
  } catch {
    /* 保存できなければ、ログイン後にもう一度まとめてもらう */
  }
}

/** 提示された下書きで依頼する (ログインが要る)。guest_token はゲストのときに始めた会話を引き継ぐときだけ */
export function submitCustomOrder(conversationId: number, messageId: number, token: string | null, guestToken?: string | null) {
  return api<{ conversation_id: number; service_request: { id: number }; message: ConciergeMessage }>(
    `/ai_concierge/conversations/${conversationId}/custom_orders`,
    { method: "POST", body: jsonBody({ message_id: messageId, guest_token: guestToken ?? undefined }), auth: token },
  );
}

/** チャットを開く。starter があれば、その発話を送って会話を始める */
export function openConcierge(detail: OpenConciergeDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenConciergeDetail>(OPEN_EVENT, { detail }));
}

export function onOpenConcierge(handler: (detail: OpenConciergeDetail) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<OpenConciergeDetail>).detail ?? {});
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}

/** オーダーメイドの相談を始める発話。参考の商品があれば添える */
export function customOrderStarter(productName?: string | null) {
  return productName ? `「${productName}」を参考に、オーダーメイドの制作を相談したいです` : "オーダーメイドの制作を相談したいです";
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
