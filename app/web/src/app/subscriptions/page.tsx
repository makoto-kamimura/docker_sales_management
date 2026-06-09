"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen } from "@/lib/format";
import type { Address, Product, Subscription, SubscriptionPlan } from "@/lib/types";

export default function SubscriptionsPage() {
  const { token } = useAuth();
  const { data: subs, mutate } = useSWR<Subscription[]>(token ? "subs" : null,
    () => api<Subscription[]>("/subscriptions", { auth: token }));
  const { data: plans } = useSWR<SubscriptionPlan[]>("plans", () => api<SubscriptionPlan[]>("/subscription_plans"));
  const { data: products } = useSWR<Product[]>("subscribable",
    () => api<Product[]>("/products").then((ps) => ps.filter((p) => p.is_subscribable)));
  const { data: addresses } = useSWR<Address[]>(token ? "sub-addr" : null, () => api<Address[]>("/me/addresses", { auth: token }));

  const [planId, setPlanId] = useState("");
  const [productId, setProductId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (!token) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;

  async function create() {
    setErr(null);
    try {
      await api("/subscriptions", {
        method: "POST",
        body: jsonBody({
          subscription_plan_id: Number(planId || plans?.[0]?.id),
          product_id: Number(productId || products?.[0]?.id),
          address_id: Number(addressId || addresses?.[0]?.id),
        }),
        auth: token,
      });
      mutate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    }
  }

  async function update(id: number, action_type: string, extra: object = {}) {
    await api(`/subscriptions/${id}`, { method: "PATCH", body: jsonBody({ action_type, ...extra }), auth: token });
    mutate();
  }
  async function cancel(id: number) {
    if (!confirm("解約しますか？")) return;
    await api(`/subscriptions/${id}`, { method: "DELETE", auth: token });
    mutate();
  }
  async function skip(id: number) {
    await api(`/subscriptions/${id}/skip`, { method: "POST", auth: token });
    mutate();
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <section>
        <h1 className="text-2xl font-bold mb-4">サブスクリプション</h1>
        {!subs?.length && (
          <div className="card p-10 text-center text-sm text-coffee-500">購読中のサブスクはありません</div>
        )}
        <ul className="space-y-3">
          {subs?.map((s) => (
            <li key={s.id} className="card p-5">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="font-semibold">{s.product.name}</div>
                  <div className="text-xs text-coffee-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="badge badge-accent">{s.plan.name}</span>
                    <span>次回 {s.next_delivery_on}</span>
                    <span className={`badge ${s.status === "active" ? "badge-success" : "badge-muted"}`}>{s.status}</span>
                  </div>
                </div>
                <div className="font-bold text-lg tabular-nums">{yen(s.product.price_cents)}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.status === "active" && <button onClick={() => update(s.id, "pause")} className="btn btn-outline !py-1.5 !px-3 !text-xs">一時停止</button>}
                {s.status === "paused" && <button onClick={() => update(s.id, "resume")} className="btn btn-outline !py-1.5 !px-3 !text-xs">再開</button>}
                {s.status !== "cancelled" && <button onClick={() => skip(s.id)} className="btn btn-outline !py-1.5 !px-3 !text-xs">次回スキップ</button>}
                {s.status !== "cancelled" && <button onClick={() => cancel(s.id)} className="btn btn-outline !py-1.5 !px-3 !text-xs !text-rose-600 hover:!border-rose-300">解約</button>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">新規購読</h2>
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
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button onClick={create} className="btn btn-primary">購読開始</button>
      </section>
    </div>
  );
}
