"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen } from "@/lib/format";
import { estimateSubscriptionCharge, goToStripe, useCardEnabled, useCheckoutReturn, useLegalNotice } from "@/lib/payments";
import type { Address, Product, Subscription, SubscriptionPlan } from "@/lib/types";

const STATUS_BADGE: Record<Subscription["status"], string> = {
  active: "badge-success", paused: "badge-muted", incomplete: "badge-accent", past_due: "badge-accent", cancelled: "badge-muted",
};

// 定期便。カード (Stripe) で、お届けの間隔ごとに自動で決済する。支払いカードの変更は Stripe の画面で行う
export default function SubscriptionsPage() {
  const { token } = useAuth();
  const { data: subs, mutate } = useSWR<Subscription[]>(token ? "subs" : null,
    () => api<Subscription[]>("/subscriptions", { auth: token }));
  const { data: plans } = useSWR<SubscriptionPlan[]>("plans", () => api<SubscriptionPlan[]>("/subscription_plans"));
  const { data: products } = useSWR<Product[]>("subscribable",
    () => api<Product[]>("/products").then((ps) => ps.filter((p) => p.is_subscribable)));
  const { data: addresses } = useSWR<Address[]>(token ? "sub-addr" : null, () => api<Address[]>("/me/addresses", { auth: token }));
  const cardEnabled = useCardEnabled();
  const notice = useLegalNotice();
  const checkout = useCheckoutReturn(() => mutate());

  const [planId, setPlanId] = useState("");
  const [productId, setProductId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;

  const hasCardSubscription = subs?.some((s) => s.card && s.status !== "cancelled" && s.status !== "incomplete");
  // 申し込む内容 (未選択なら先頭) と、1回あたりの金額の見込み (定期購入の最終確認として申し込み前に示す)
  const plan = plans?.find((p) => String(p.id) === planId) ?? plans?.[0];
  const product = products?.find((p) => String(p.id) === productId) ?? products?.[0];
  const charge = plan && product && notice
    ? estimateSubscriptionCharge(product.price_cents, plan.discount_percent, 1, notice.pricing) : null;

  async function run(fn: () => Promise<unknown>) {
    setErr(null);
    try {
      await fn();
      mutate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    }
  }

  // 申し込み: 手続き中で記録され、決済の画面 (Stripe Checkout) へ移る
  async function create() {
    setErr(null);
    setBusy(true);
    try {
      const sub = await api<Subscription & { checkout_url: string }>("/subscriptions", {
        method: "POST",
        body: jsonBody({
          subscription_plan_id: Number(planId || plans?.[0]?.id),
          product_id: Number(productId || products?.[0]?.id),
          address_id: Number(addressId || addresses?.[0]?.id),
        }),
        auth: token,
      });
      window.location.assign(sub.checkout_url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
      setBusy(false);
    }
  }

  const update = (id: number, action_type: string) =>
    run(() => api(`/subscriptions/${id}`, { method: "PATCH", body: jsonBody({ action_type }), auth: token }));
  const skip = (id: number) => run(() => api(`/subscriptions/${id}/skip`, { method: "POST", auth: token }));
  const cancel = (s: Subscription) => {
    if (!confirm(s.status === "incomplete" ? "申し込みを取り消しますか？" : "解約しますか？")) return;
    run(() => api(`/subscriptions/${s.id}`, { method: "DELETE", auth: token }));
  };
  const openPortal = () => run(() => goToStripe("/subscriptions/portal_session", token));

  return (
    <div className="space-y-8 max-w-3xl">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold">サブスクリプション</h1>
          {hasCardSubscription && (
            <button onClick={openPortal} className="btn btn-outline !py-1.5 !px-3 !text-xs">支払いカードの変更</button>
          )}
        </div>
        {checkout === "success" && (
          <p role="status" className="mb-4 rounded-xl bg-[#e7f6ec] px-4 py-3 text-sm text-[#1f7a46]">
            お申し込みありがとうございます。反映まで少し時間がかかることがあります。
          </p>
        )}
        {checkout === "cancel" && (
          <p role="status" className="mb-4 rounded-xl bg-coffee-50 border border-coffee-100 px-4 py-3 text-sm text-coffee-700">
            お申し込みを中断しました。手続き中の申し込みは、そのままにしておくと自動で取り消されます。
          </p>
        )}
        {err && <p role="alert" className="mb-4 text-sm text-rose-600">{err}</p>}
        {!subs?.length && (
          <div className="card p-10 text-center text-sm text-coffee-500">購読中のサブスクはありません</div>
        )}
        <ul className="space-y-3">
          {subs?.map((s) => {
            const open = s.status !== "cancelled" && s.status !== "incomplete";
            return (
              <li key={s.id} className="card p-5">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="font-semibold">{s.product.name} <span className="text-coffee-400 text-sm">× {s.quantity}</span></div>
                    <div className="text-xs text-coffee-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="badge badge-accent">{s.plan.name}</span>
                      {open && <span>次回 {s.next_delivery_on}</span>}
                      <span className={`badge ${STATUS_BADGE[s.status]}`}>{s.status_label}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg tabular-nums">{yen(s.charge_cents)}</div>
                    <div className="text-xs text-coffee-400">1回あたり (税・送料込み)</div>
                  </div>
                </div>
                {s.status === "past_due" && (
                  <p className="mt-3 text-sm text-rose-600">
                    カードの決済ができませんでした。「支払いカードの変更」からカードを更新してください。
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.status === "active" && <button onClick={() => update(s.id, "pause")} className="btn btn-outline !py-1.5 !px-3 !text-xs">一時停止</button>}
                  {s.status === "paused" && <button onClick={() => update(s.id, "resume")} className="btn btn-outline !py-1.5 !px-3 !text-xs">再開</button>}
                  {open && <button onClick={() => skip(s.id)} className="btn btn-outline !py-1.5 !px-3 !text-xs">次回スキップ</button>}
                  {s.status !== "cancelled" && (
                    <button onClick={() => cancel(s)} className="btn btn-outline !py-1.5 !px-3 !text-xs !text-rose-600 hover:!border-rose-300">
                      {s.status === "incomplete" ? "申し込みを取り消す" : "解約"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">新規購読</h2>
        {cardEnabled === false ? (
          <p className="text-sm text-coffee-500">定期便のお申し込みは準備中です。</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select className="input" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">プラン</option>
                {plans?.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.interval_days}日 / -{p.discount_percent}%)</option>)}
              </select>
              <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">商品</option>
                {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select className="input" value={addressId} onChange={(e) => setAddressId(e.target.value)}>
                <option value="">お届け先</option>
                {addresses?.map((a) => <option key={a.id} value={a.id}>{a.recipient} / {a.prefecture}{a.city}</option>)}
              </select>
            </div>
            {plan && product && (
              <dl className="rounded-xl border border-coffee-100 bg-coffee-50/60 p-4 text-sm space-y-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-coffee-600">{product.name} × 1・{plan.name}</dt>
                  <dd className="text-right">
                    <span className="font-bold tabular-nums">{charge != null ? yen(charge) : "…"}</span>
                    <span className="block text-xs text-coffee-400">1回あたり（{plan.discount_percent}% 割引・税・送料込み）</span>
                  </dd>
                </div>
                <div className="text-xs text-coffee-600 space-y-1 border-t border-coffee-100 pt-2">
                  <p>お届け・お支払い：お申し込み時に1回目を、以後は {plan.interval_days} 日ごとにクレジットカードで決済し、お届けします。</p>
                  <p>契約期間：解約されるまで続きます（回数の定めはありません）。</p>
                  <p>解約・一時停止・スキップ：この画面からいつでもでき、次回の決済から反映されます。決済済みの回はキャンセルできません。</p>
                </div>
              </dl>
            )}
            <p className="text-xs text-coffee-500">
              決済サービス (Stripe) の画面でカード情報を入力します。カード情報はこのサイトには保存しません。
              詳しくは <a href="/legal/tokushoho" target="_blank" rel="noopener" className="text-caramel hover:underline">特定商取引法に基づく表記</a> をご覧ください。
            </p>
            <button onClick={create} disabled={busy} className="btn btn-primary">
              {busy ? "決済の画面を開いています…" : "上記の内容でカードで申し込む"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
