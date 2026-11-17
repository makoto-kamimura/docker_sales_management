// AIコンシェルジュ (Claude)。API が Claude を呼び、会話履歴は API 側に残る。
// API キーが未設定なら settings が enabled: false を返すので、タブを出さない

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, type Href } from 'expo-router';

import { api, jsonBody } from '@/lib/api';

/** AIコンシェルジュが提示したオーダーメイドの下書き (制作依頼書)。依頼にしたら service_request_id が入る */
export type OrderDraft = { title: string; markdown: string; service_request_id: number | null };
export type ConciergeMessage = {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  cta?: string | null;
  order_draft?: OrderDraft | null;
};
export type ConciergeSettings = { enabled: boolean; max_content_length: number };
/** ゲストの会話は、作成時に受け取った guest_token を添えて使う */
export type ConciergeSession = { owner: string; id: number; guest_token: string | null };

/** AIコンシェルジュが使えるか。確かめ終わるまで (と、確かめられないとき) は undefined */
export function useConciergeSettings(): ConciergeSettings | undefined {
  const [settings, setSettings] = useState<ConciergeSettings>();
  useEffect(() => {
    let cancelled = false;
    api<ConciergeSettings>('/ai_concierge/settings')
      .then((s) => { if (!cancelled) setSettings(s); })
      .catch(() => { /* つながらないときは出さない */ });
    return () => { cancelled = true; };
  }, []);
  return settings;
}

export async function startConversation(owner: string, token: string | null): Promise<ConciergeSession> {
  const c = await api<{ id: number; guest_token: string | null }>('/ai_concierge/conversations', { method: 'POST', auth: token });
  return { owner, id: c.id, guest_token: c.guest_token };
}

/** 会話の履歴 (ログイン後に引き継いだ会話を表示し直すとき) */
export async function fetchMessages(session: ConciergeSession, token: string | null) {
  const q = session.guest_token ? `?guest_token=${encodeURIComponent(session.guest_token)}` : '';
  const c = await api<{ messages: ConciergeMessage[] }>(`/ai_concierge/conversations/${session.id}${q}`, { auth: token });
  return c.messages;
}

export function postMessage(session: ConciergeSession, content: string, token: string | null) {
  return api<ConciergeMessage>(`/ai_concierge/conversations/${session.id}/messages`, {
    method: 'POST',
    body: jsonBody({ content, guest_token: session.guest_token ?? undefined }),
    auth: token,
  });
}

/** 「はい」で依頼したときに、API が会話に残す発話 (画面にも同じ文を出す) */
export const ACCEPT_ORDER_TEXT = 'はい、この内容でオーダーします';
/** 「修正する」で送る発話 */
export const REVISE_ORDER_TEXT = '内容を修正したいです';

/** オーダーメイドの相談を始める発話。参考の商品があれば添える */
export function customOrderStarter(productName?: string | null) {
  return productName ? `「${productName}」を参考に、オーダーメイドの制作を相談したいです` : 'オーダーメイドの制作を相談したいです';
}

/** 提示された下書きで依頼する (ログインが要る)。guest_token はゲストのときに始めた会話を引き継ぐときだけ */
export function submitCustomOrder(conversationId: number, messageId: number, token: string | null, guestToken?: string | null) {
  return api<{ conversation_id: number; service_request: { id: number }; message: ConciergeMessage }>(
    `/ai_concierge/conversations/${conversationId}/custom_orders`,
    { method: 'POST', body: jsonBody({ message_id: messageId, guest_token: guestToken ?? undefined }), auth: token },
  );
}

/** ゲストが「はい」を押した下書き。ログインしたら、この内容で依頼できるようにする */
export type PendingOrder = { conversation_id: number; guest_token: string; message_id: number; title: string; markdown: string };
const PENDING_ORDER_KEY = 'cf_concierge_order';

export async function readPendingOrder(): Promise<PendingOrder | null> {
  try {
    const p = JSON.parse((await AsyncStorage.getItem(PENDING_ORDER_KEY)) ?? 'null') as PendingOrder | null;
    return p && typeof p.conversation_id === 'number' && typeof p.message_id === 'number' ? p : null;
  } catch {
    return null;
  }
}

export async function writePendingOrder(order: PendingOrder | null) {
  try {
    if (order) await AsyncStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(order));
    else await AsyncStorage.removeItem(PENDING_ORDER_KEY);
  } catch {
    /* 保存できなければ、ログイン後にもう一度まとめてもらう */
  }
}

/** ログイン・会員登録の後の行き先。ゲストのときにオーダーの「はい」を押していたら、チャットでその内容を確かめてもらう */
export async function routeAfterLogin() {
  router.replace((await readPendingOrder()) ? '/(tabs)/chat' : '/(tabs)/account');
}

/** 応答に付く CTA (API が切り出した action) を、アプリ内の画面にする。知らないものは出さない */
export function ctaLink(cta: string): { href: Href; label: string } | null {
  const [action, arg] = cta.split(':');
  switch (action) {
    case 'open_custom_request':
      return { href: { pathname: '/service-request', params: { kind: 'custom' } }, label: 'オーダーメイドを依頼する' };
    case 'open_contact':
      return { href: { pathname: '/service-request', params: { kind: 'inquiry' } }, label: '問い合わせる' };
    case 'human_handoff':
      return { href: { pathname: '/service-request', params: { kind: 'inquiry' } }, label: 'スタッフに問い合わせる' };
    case 'open_subscription_settings':
      return { href: '/subscriptions', label: 'サブスクの設定を開く' };
    case 'view_requests':
      return { href: '/requests', label: '問い合わせ・依頼を見る' };
    case 'view_product':
      return arg ? { href: { pathname: '/products/[id]', params: { id: arg } }, label: '商品ページを見る' } : null;
    case 'view_order':
      return arg ? { href: { pathname: '/orders/[id]', params: { id: arg } }, label: `注文 #${arg} を見る` } : null;
    default:
      return null;
  }
}

/** 最初に出す質問の例。休止中のオーダーメイドは出さない */
export function suggestions(loggedIn: boolean, customOrders: boolean): string[] {
  return [
    loggedIn ? '注文の状況を知りたい' : 'どんな作品がありますか？',
    customOrders ? 'オーダーメイドを相談したい' : '3Dデータの受け取り方は？',
    '支払い方法と送料は？',
  ];
}
