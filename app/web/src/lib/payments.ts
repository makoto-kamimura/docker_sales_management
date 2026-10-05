"use client";

// カード決済 (Stripe)。カード情報の入力は Stripe の決済画面 (Checkout) で行い、このサイトには保存しない。
// 支払いの結果は Stripe からの通知 (Webhook) で API に反映される

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { LegalNotice } from "@/lib/types";

/** カード決済が使えるか (Stripe の設定がなければ、カードの選択肢を出さない) */
export function useCardEnabled(): boolean | undefined {
  const { data } = useSWR("payment-settings", () => api<{ card_enabled: boolean }>("/payment_settings"));
  return data?.card_enabled;
}

/** 決済の画面 (Stripe Checkout / Customer Portal) の URL を API から受け取って移動する */
export async function goToStripe(path: string, token: string | null) {
  const { url } = await api<{ url: string }>(path, { method: "POST", auth: token });
  window.location.assign(url);
}

/**
 * 決済の画面から戻ってきたとき (?checkout=success / cancel)。結果を返し、URL の印は消す。
 * Webhook の反映が少し遅れることがあるので、成功なら数回取り直す
 */
export function useCheckoutReturn(refresh: () => unknown): "success" | "cancel" | null {
  const [result, setResult] = useState<"success" | "cancel" | null>(null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("checkout");
    if (r !== "success" && r !== "cancel") return;
    setResult(r);
    window.history.replaceState(null, "", window.location.pathname);
    if (r !== "success") return;
    const timers = [1_500, 4_000, 8_000].map((ms) => setTimeout(() => refreshRef.current(), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  return result;
}

/** 特定商取引法に基づく表記 (支払時期・お届け時期・返品の条件など。注文確認画面でも使う) */
export function useLegalNotice() {
  return useSWR("legal-notice", () => api<LegalNotice>("/legal_notice")).data;
}

/** 定期便の1回あたりの金額 (税・送料込み) の見込み。API の Pricing と同じ計算 */
export function estimateSubscriptionCharge(priceCents: number, discountPercent: number, quantity: number, pricing: LegalNotice["pricing"]) {
  const subtotal = Math.round((priceCents * (100 - discountPercent)) / 100) * quantity;
  const tax = Math.round((subtotal * pricing.tax_rate_percent) / 100);
  const shipping = subtotal >= pricing.free_shipping_threshold_cents ? 0 : pricing.shipping_flat_cents;
  return subtotal + tax + shipping;
}
