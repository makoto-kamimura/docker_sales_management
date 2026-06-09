"use client";

import Link from "next/link";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen } from "@/lib/format";
import type { Cart } from "@/lib/types";

export default function CartPage() {
  const { token } = useAuth();
  const { data: cart, mutate } = useSWR<Cart>(token ? "cart" : null, () => api<Cart>("/cart", { auth: token }));

  async function setQty(id: number, quantity: number) {
    await api(`/cart/items/${id}`, { method: "PATCH", body: jsonBody({ quantity }), auth: token });
    mutate();
  }
  async function remove(id: number) {
    await api(`/cart/items/${id}`, { method: "DELETE", auth: token });
    mutate();
  }

  if (!token) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;
  if (!cart) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-2xl font-bold">カート</h1>
      {cart.items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-coffee-500">
          カートは空です。
          <Link href="/search" className="text-caramel hover:underline ml-1">商品を探す →</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-coffee-50 text-xs uppercase tracking-wide text-coffee-500">
              <tr><th className="p-3 text-left font-semibold">商品</th><th className="p-3 text-right font-semibold">単価</th><th className="p-3 text-center font-semibold">数量</th><th className="p-3 text-right font-semibold">小計</th><th></th></tr>
            </thead>
            <tbody className="text-sm">
              {cart.items.map((i) => (
                <tr key={i.id} className="border-t border-coffee-100">
                  <td className="p-3 font-medium">{i.name}</td>
                  <td className="p-3 text-right tabular-nums">{yen(i.unit_price_cents)}</td>
                  <td className="p-3 text-center">
                    <input type="number" min={1} max={99} value={i.quantity}
                           onChange={(e) => setQty(i.id, Number(e.target.value))}
                           className="input !w-16 text-center" />
                  </td>
                  <td className="p-3 text-right font-semibold tabular-nums">{yen(i.line_total_cents)}</td>
                  <td className="p-3 text-right"><button onClick={() => remove(i.id)} className="text-xs text-rose-500 hover:text-rose-600 hover:underline">削除</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-coffee-100 px-4 py-3 bg-coffee-50/50">
            <span className="text-sm text-coffee-500">合計</span>
            <span className="text-xl font-bold">{yen(cart.subtotal_cents)}</span>
          </div>
        </div>
      )}
      {cart.items.length > 0 && (
        <div className="text-right">
          <Link href="/checkout" className="btn btn-primary">
            注文へ進む →
          </Link>
        </div>
      )}
    </div>
  );
}
