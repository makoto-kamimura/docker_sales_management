// カード決済 (Stripe)。カード情報の入力は Stripe の決済画面 (Checkout) で行い、アプリには保存しない。
// 支払いの結果は Stripe からの通知 (Webhook) で API に反映される
import * as WebBrowser from 'expo-web-browser';

import { api, apiOriginUrl, jsonBody } from '@/lib/api';
import type { LegalNotice } from '@/lib/types';

/** カード決済が使えるか (Stripe の設定がなければ、カードの選択肢を出さない) */
export async function fetchCardEnabled(): Promise<boolean> {
  try {
    return (await api<{ card_enabled: boolean }>('/payment_settings')).card_enabled;
  } catch {
    return false;
  }
}

/**
 * 決済の画面 (Stripe Checkout / Customer Portal) をアプリ内ブラウザで開く。
 * 戻り先はアプリに戻るよう案内する Web のページ (client: app)。閉じたら呼び出し側で取り直す
 */
export async function openStripe(path: string, token: string | null) {
  const { url } = await api<{ url: string }>(path, { method: 'POST', body: jsonBody({ client: 'app' }), auth: token });
  await WebBrowser.openBrowserAsync(url);
}

/** 特定商取引法に基づく表記 (店舗の方針。注文確認画面で使う) */
export async function fetchLegalNotice(): Promise<LegalNotice | null> {
  try {
    return await api<LegalNotice>('/legal_notice');
  } catch {
    return null;
  }
}

/** 特定商取引法に基づく表記の Web のページを開く (Web と API は同じオリジン) */
export function openLegalNotice() {
  return WebBrowser.openBrowserAsync(apiOriginUrl('/legal/tokushoho'));
}
