"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen } from "@/lib/format";
import type { Address, Cart, Order } from "@/lib/types";

export default function CheckoutPage() {
  const { token } = useAuth();
  const router = useRouter();
  const { data: cart } = useSWR<Cart>(token ? "cart-check" : null, () => api<Cart>("/cart", { auth: token }));
  const { data: addresses } = useSWR<Address[]>(token ? "addr-check" : null, () => api<Address[]>("/me/addresses", { auth: token }));
  const [addressId, setAddressId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function placeOrder() {
    setBusy(true); setErr(null);
    try {
      const order = await api<Order>("/orders", {
        method: "POST",
        body: jsonBody({ address_id: Number(addressId || addresses?.[0]?.id) }),
        auth: token,
      });
      router.push(`/orders/${order.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  if (!token) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;
  if (!cart || !addresses) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold">ご注文確認</h1>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">お届け先</h2>
        {addresses.length === 0 ? (
          <p className="text-sm">先に <a href="/account" className="text-caramel hover:underline">住所を登録</a> してください。</p>
        ) : (
          <select value={addressId || String(addresses[0].id)} onChange={(e) => setAddressId(e.target.value)}
                  className="input">
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>{a.recipient} - {a.prefecture}{a.city}{a.line1}</option>
            ))}
          </select>
        )}
      </section>

      <section className="card p-5 text-sm">
        <h2 className="font-semibold mb-3">明細</h2>
        <ul className="divide-y divide-coffee-100">
          {cart.items.map((i) => (
            <li key={i.id} className="flex justify-between py-2">
              <span>{i.name} <span className="text-coffee-400">× {i.quantity}</span></span>
              <span className="tabular-nums">{yen(i.line_total_cents)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between font-bold text-base border-t border-coffee-100 mt-2 pt-3">
          <span>小計</span><span className="tabular-nums">{yen(cart.subtotal_cents)}</span>
        </div>
        <div className="text-xs text-coffee-500 mt-1">※ 税/送料はサーバー側で計算されます</div>
      </section>

      {err && <p className="text-sm text-rose-600">{err}</p>}
      <button onClick={placeOrder} disabled={busy || cart.items.length === 0 || addresses.length === 0}
              className="btn btn-primary w-full !py-3 text-base">
        注文を確定する
      </button>
    </div>
  );
}
