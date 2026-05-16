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

  if (!token) return <p>ログインが必要です。</p>;
  if (!cart || !addresses) return <p>読み込み中…</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold">ご注文確認</h1>

      <section className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-2">お届け先</h2>
        {addresses.length === 0 ? (
          <p className="text-sm">先に <a href="/account" className="underline">住所を登録</a> してください。</p>
        ) : (
          <select value={addressId || String(addresses[0].id)} onChange={(e) => setAddressId(e.target.value)}
                  className="w-full rounded border px-2 py-2">
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>{a.recipient} - {a.prefecture}{a.city}{a.line1}</option>
            ))}
          </select>
        )}
      </section>

      <section className="bg-white border rounded-xl p-4 text-sm">
        <h2 className="font-semibold mb-2">明細</h2>
        <ul>
          {cart.items.map((i) => (
            <li key={i.id} className="flex justify-between py-1">
              <span>{i.name} × {i.quantity}</span>
              <span>{yen(i.line_total_cents)}</span>
            </li>
          ))}
        </ul>
        <hr className="my-2" />
        <div className="flex justify-between font-semibold"><span>小計</span><span>{yen(cart.subtotal_cents)}</span></div>
        <div className="text-xs text-coffee-500 mt-1">※ 税/送料はサーバー側で計算されます</div>
      </section>

      {err && <p className="text-sm text-rose-600">{err}</p>}
      <button onClick={placeOrder} disabled={busy || cart.items.length === 0 || addresses.length === 0}
              className="w-full rounded bg-espresso text-white py-3 disabled:opacity-50">
        注文を確定する
      </button>
    </div>
  );
}
