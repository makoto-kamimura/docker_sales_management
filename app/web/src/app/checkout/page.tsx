"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen } from "@/lib/format";
import { goToStripe, useCardEnabled, useLegalNotice } from "@/lib/payments";
import type { Address, Cart, Order, PaymentKind } from "@/lib/types";

export default function CheckoutPage() {
  const { token } = useAuth();
  const router = useRouter();
  const { data: cart } = useSWR<Cart>(token ? "cart-check" : null, () => api<Cart>("/cart", { auth: token }));
  const { data: addresses } = useSWR<Address[]>(token ? "addr-check" : null, () => api<Address[]>("/me/addresses", { auth: token }));
  const [addressId, setAddressId] = useState<string>("");
  const cardEnabled = useCardEnabled();
  const notice = useLegalNotice();
  const [payment, setPayment] = useState<PaymentKind>("card");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 0円の注文 (無料配布だけ) は支払いがない
  const free = cart?.subtotal_cents === 0;
  const paymentKind: PaymentKind = cardEnabled && !free ? payment : "transfer";

  async function placeOrder() {
    setBusy(true); setErr(null);
    let order: Order;
    try {
      order = await api<Order>("/orders", {
        method: "POST",
        // デジタル商品のみの注文は配送先なし
        body: jsonBody({
          payment_kind: paymentKind,
          ...(cart?.requires_shipping ? { address_id: Number(addressId || addresses?.[0]?.id) } : {}),
        }),
        auth: token,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
      setBusy(false);
      return;
    }
    if (order.card_payable) {
      try {
        await goToStripe(`/orders/${order.id}/checkout_session`, token);
        return;
      } catch {
        // 注文はできている。注文詳細の「カードで支払う」から払い直せる
      }
    }
    router.push(`/orders/${order.id}`);
  }

  if (!token) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;
  if (!cart || !addresses) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold">ご注文確認</h1>

      {cart.requires_shipping ? (
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
      ) : (
        <section className="card p-5 text-sm">
          <h2 className="font-semibold mb-1">お届け方法</h2>
          <p className="text-coffee-600">ダウンロード (配送なし・送料無料)。お支払い確認後、注文詳細からダウンロードできます。</p>
        </section>
      )}

      <section className="card p-5 text-sm">
        <h2 className="font-semibold mb-3">明細</h2>
        <ul className="divide-y divide-coffee-100">
          {cart.items.map((i) => (
            <li key={i.id} className="flex justify-between py-2">
              <span>{i.name} <span className="text-coffee-400">{i.is_digital ? "(データ)" : `× ${i.quantity}`}</span></span>
              <span className="tabular-nums">{yen(i.line_total_cents)}</span>
            </li>
          ))}
        </ul>
        <dl className="border-t border-coffee-100 mt-2 pt-3 space-y-1">
          <div className="flex justify-between text-coffee-600"><dt>小計</dt><dd className="tabular-nums">{yen(cart.subtotal_cents)}</dd></div>
          <div className="flex justify-between text-coffee-600"><dt>消費税</dt><dd className="tabular-nums">{yen(cart.tax_cents)}</dd></div>
          <div className="flex justify-between text-coffee-600"><dt>送料</dt><dd className="tabular-nums">{yen(cart.shipping_cents)}</dd></div>
          <div className="flex justify-between font-bold text-base pt-1"><dt>お支払い金額（税込）</dt><dd className="tabular-nums">{yen(cart.total_cents)}</dd></div>
        </dl>
      </section>

      {cardEnabled && !free && (
        <section className="card p-5 text-sm">
          <h2 className="font-semibold mb-3">お支払い方法</h2>
          <div className="space-y-2" role="radiogroup" aria-label="お支払い方法">
            {([
              ["card", "クレジットカード", "決済サービス (Stripe) の画面でカード情報を入力します。カード情報はこのサイトには保存しません。"],
              ["transfer", "銀行振込など", "ご注文後にショップからお支払い方法をご連絡します。入金を確認してから制作・発送します。"],
            ] as const).map(([kind, label, note]) => (
              <label key={kind} className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                payment === kind ? "border-caramel bg-caramel/5" : "border-coffee-100 hover:border-coffee-200"}`}>
                <input type="radio" name="payment" value={kind} checked={payment === kind}
                       onChange={() => setPayment(kind)} className="mt-1 accent-caramel" />
                <span>
                  <span className="font-medium">{label}</span>
                  <span className="block text-xs text-coffee-500 mt-0.5">{note}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="card p-5 text-sm space-y-3" aria-labelledby="confirm-heading">
        <h2 id="confirm-heading" className="font-semibold">ご注文前にご確認ください</h2>
        <dl className="space-y-3">
          {!free && (
            <div>
              <dt className="text-xs font-semibold text-coffee-500">お支払い時期</dt>
              <dd className="mt-0.5">
                {paymentKind === "card"
                  ? "ご注文の確定後に表示される決済画面で、クレジットカードでお支払いいただきます。"
                  : notice?.transfer_payment_due || "ご注文後にショップから振込先をご連絡します。"}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-semibold text-coffee-500">お届け時期</dt>
            <dd className="mt-0.5 space-y-0.5">
              {cart.requires_shipping && <p>{notice?.shipping_lead_time || "入金確認後に制作・発送します。"}</p>}
              {cart.items.some((i) => i.is_digital) && <p>3Dデータ・DIY設計図は、お支払いの確認後すぐに注文詳細からダウンロードできます。</p>}
            </dd>
          </div>
          {notice?.returns_policy && (
            <div>
              <dt className="text-xs font-semibold text-coffee-500">返品・交換・キャンセル</dt>
              <dd className="mt-0.5 whitespace-pre-line text-coffee-700">{notice.returns_policy}</dd>
            </div>
          )}
        </dl>
        <p className="text-xs text-coffee-500">
          詳しくは <a href="/legal/tokushoho" target="_blank" rel="noopener" className="text-caramel hover:underline">特定商取引法に基づく表記</a> をご覧ください。
        </p>
      </section>

      {err && <p className="text-sm text-rose-600">{err}</p>}
      <button onClick={placeOrder} disabled={busy || cart.items.length === 0 || (cart.requires_shipping && addresses.length === 0)}
              className="btn btn-primary w-full !py-3 text-base">
        {busy ? "処理中…" : paymentKind === "card" ? "上記の内容で注文を確定し、カードで支払う" : "上記の内容で注文を確定する"}
      </button>
    </div>
  );
}
