"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate, yen } from "@/lib/format";
import type { Order, Product, RequestKind } from "@/lib/types";

type Props = {
  /** inquiry: 問い合わせ / custom: オーダーメイド制作依頼 */
  kind: RequestKind;
  submitLabel: string;
  /** 初期選択 (商品詳細・注文詳細からの導線) */
  initialProductId?: string;
  initialOrderId?: string;
};

export function RequestForm({ kind, submitLabel, initialProductId = "", initialOrderId = "" }: Props) {
  const { token } = useAuth();
  const router = useRouter();

  // オーダーメイド: 参考にする制作メニュー / 問い合わせ: 対象の注文
  const { data: menu } = useSWR<Product[]>(
    kind === "custom" ? "menu-custom" : null,
    () => api<Product[]>("/products?category_slug=custom")
  );
  const { data: orders } = useSWR<Order[]>(
    kind === "inquiry" && token ? "orders-for-inquiry" : null,
    () => api<Order[]>("/orders", { auth: token })
  );

  const [productId, setProductId] = useState(initialProductId);
  const [orderId, setOrderId] = useState(initialOrderId);
  const [subject, setSubject] = useState("");
  const [preferredAt, setPreferredAt] = useState("");
  const [budget, setBudget] = useState("");
  const [body, setBody] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { router.push("/login"); return; }
    setBusy(true); setError(null);
    try {
      await api("/service_requests", {
        method: "POST",
        body: jsonBody({
          kind,
          subject,
          body,
          contact_phone: phone,
          product_id: kind === "custom" && productId ? Number(productId) : null,
          order_id: kind === "inquiry" && orderId ? Number(orderId) : null,
          preferred_at: kind === "custom" && preferredAt ? preferredAt : null,
          budget_cents: kind === "custom" && budget ? Number(budget) : null,
        }),
        auth: token,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card p-8 text-center space-y-4">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-caramel text-white text-xl font-bold">✓</div>
        <h2 className="text-lg font-bold">受け付けました</h2>
        <p className="text-sm text-coffee-500">
          担当者が内容を確認し、ご連絡します。回答や進捗は「問い合わせ」からご確認いただけます。
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/requests" className="btn btn-primary">問い合わせ一覧へ</Link>
          <Link href="/" className="btn btn-outline">トップへ</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-5">
      {!token && (
        <p className="rounded-lg bg-coffee-50 border border-coffee-200 px-3 py-2 text-xs text-coffee-500">
          送信にはログインが必要です。送信時にログイン画面へ移動します。
        </p>
      )}

      {kind === "custom" ? (
        <div>
          <label className="field-label" htmlFor="req-product">制作メニュー（任意）</label>
          <select id="req-product" value={productId} onChange={(e) => setProductId(e.target.value)} className="input">
            <option value="">選択しない（相談のみ）</option>
            {menu?.map((m) => (
              <option key={m.id} value={m.id}>{m.name}（{yen(m.price_cents)}〜）</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="field-label" htmlFor="req-order">対象の注文（任意）</label>
          <select id="req-order" value={orderId} onChange={(e) => setOrderId(e.target.value)} className="input">
            <option value="">選択しない</option>
            {orders?.map((o) => (
              <option key={o.id} value={o.id}>注文 #{o.id}（{fmtDate(o.placed_at)} / {o.status_label}）</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="field-label" htmlFor="req-subject">{kind === "custom" ? "作りたいもの" : "件名"}</label>
        <input id="req-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="input" required={kind === "inquiry"}
               placeholder={kind === "custom" ? "例: イニシャル入りの名刺入れ" : "例: 納期について"} />
      </div>

      {kind === "custom" && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="req-due">希望納期（任意）</label>
            <input id="req-due" type="date" value={preferredAt} onChange={(e) => setPreferredAt(e.target.value)} className="input" />
          </div>
          <div>
            <label className="field-label" htmlFor="req-budget">ご予算（円・任意）</label>
            <input id="req-budget" type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)}
                   className="input" placeholder="例: 8000" />
          </div>
        </div>
      )}

      <div>
        <label className="field-label" htmlFor="req-body">{kind === "custom" ? "ご依頼内容（サイズ・素材・色・数量など）" : "お問い合わせ内容"}</label>
        <textarea id="req-body" value={body} onChange={(e) => setBody(e.target.value)} className="input min-h-[7rem]" required
                  placeholder={kind === "custom"
                    ? "例: ヌメ革の名刺入れに「H.S」と刻印してほしい。色はキャメル希望。"
                    : "例: プレゼントに間に合わせたいのですが、いつ頃発送になりますか？"} />
      </div>

      <div>
        <label className="field-label" htmlFor="req-phone">連絡先電話番号（任意）</label>
        <input id="req-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="090-0000-0000" />
      </div>

      {error && <p className="text-sm rounded-lg bg-red-50 text-red-700 px-3 py-2">{error}</p>}

      <button disabled={busy} className="btn btn-accent w-full">{busy ? "送信中…" : submitLabel}</button>
    </form>
  );
}
