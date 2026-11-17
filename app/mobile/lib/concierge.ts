// AIコンシェルジュ (Claude)。API が Claude を呼び、会話履歴は API 側に残る。
// API キーが未設定なら settings が enabled: false を返すので、タブを出さない

import { useEffect, useState } from 'react';
import type { Href } from 'expo-router';

import { api, jsonBody } from '@/lib/api';

export type ConciergeMessage = { id: number | string; role: 'user' | 'assistant'; content: string; cta?: string | null };
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

export function postMessage(session: ConciergeSession, content: string, token: string | null) {
  return api<ConciergeMessage>(`/ai_concierge/conversations/${session.id}/messages`, {
    method: 'POST',
    body: jsonBody({ content, guest_token: session.guest_token ?? undefined }),
    auth: token,
  });
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
