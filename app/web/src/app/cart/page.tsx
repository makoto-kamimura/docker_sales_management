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

  if (!token) return <p>ログインが必要です。</p>;
  if (!cart) return <p>読み込み中…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">カート</h1>
      {cart.items.length === 0 ? (
        <p className="text-sm text-coffee-500">カートは空です。<Link href="/search" className="underline">商品を探す</Link></p>
      ) : (
        <table className="w-full bg-white border rounded-xl overflow-hidden">
          <thead className="bg-coffee-50 text-sm">
            <tr><th className="p-3 text-left">商品</th><th className="p-3 text-right">単価</th><th className="p-3 text-center">数量</th><th className="p-3 text-right">小計</th><th></th></tr>
          </thead>
          <tbody className="text-sm">
            {cart.items.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="p-3">{i.name}</td>
                <td className="p-3 text-right">{yen(i.unit_price_cents)}</td>
                <td className="p-3 text-center">
                  <input type="number" min={1} max={99} value={i.quantity}
                         onChange={(e) => setQty(i.id, Number(e.target.value))}
                         className="w-16 rounded border px-2 py-1 text-center" />
                </td>
                <td className="p-3 text-right">{yen(i.line_total_cents)}</td>
                <td className="p-3 text-right"><button onClick={() => remove(i.id)} className="text-xs text-rose-600 underline">削除</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex items-center justify-between">
        <span className="text-sm text-coffee-500">合計</span>
        <span className="text-lg font-bold">{yen(cart.subtotal_cents)}</span>
      </div>
      <div className="text-right">
        <Link href="/checkout" className="inline-block rounded bg-espresso text-white px-4 py-2">
          注文へ進む
        </Link>
      </div>
    </div>
  );
}
