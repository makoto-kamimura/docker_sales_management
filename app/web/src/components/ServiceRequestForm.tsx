"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen } from "@/lib/format";
import type { Product, ServiceKind } from "@/lib/types";

type Props = {
  kind: ServiceKind;
  /** メニュー候補を引くカテゴリ slug (maintenance / system) */
  categorySlug: string;
  submitLabel: string;
};

export function ServiceRequestForm({ kind, categorySlug, submitLabel }: Props) {
  const { token } = useAuth();
  const router = useRouter();

  const { data: menu } = useSWR<Product[]>(
    `menu-${categorySlug}`,
    () => api<Product[]>(`/products?category_slug=${categorySlug}`)
  );

  const [productId, setProductId] = useState("");
  const [vehicle, setVehicle] = useState("");
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
          product_id: productId ? Number(productId) : null,
          vehicle,
          body,
          contact_phone: phone,
          preferred_at: kind === "maintenance" && preferredAt ? preferredAt : null,
          budget_cents: kind === "system" && budget ? Number(budget) : null,
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
          担当者が内容を確認し、ご連絡します。進捗は「依頼状況」からご確認いただけます。
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/requests" className="btn btn-primary">依頼状況を見る</Link>
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

      <div>
        <label className="field-label">{kind === "maintenance" ? "整備メニュー" : "システム / 機器"}（任意）</label>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className="input">
          <option value="">選択しない（相談のみ）</option>
          {menu?.map((m) => (
            <option key={m.id} value={m.id}>{m.name}（{yen(m.price_cents)}）</option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label">車種・型式</label>
        <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="input"
               placeholder="例: CB400SF / 2018年式" />
      </div>

      {kind === "maintenance" && (
        <div>
          <label className="field-label">希望日時</label>
          <input type="datetime-local" value={preferredAt} onChange={(e) => setPreferredAt(e.target.value)}
                 className="input" required />
        </div>
      )}

      {kind === "system" && (
        <div>
          <label className="field-label">想定予算（円・任意）</label>
          <input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)}
                 className="input" placeholder="例: 50000" />
        </div>
      )}

      <div>
        <label className="field-label">{kind === "maintenance" ? "整備内容・ご相談" : "ご依頼内容・要件"}</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} className="input min-h-[7rem]" required
                  placeholder={kind === "maintenance"
                    ? "例: 12ヶ月点検とチェーン清掃、できればタイヤの状態も見てほしい"
                    : "例: ツーリングナビとインカムを取り付けたい。電源の取り回しも相談したい"} />
      </div>

      <div>
        <label className="field-label">連絡先電話番号（任意）</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="090-0000-0000" />
      </div>

      {error && <p className="text-sm rounded-lg bg-red-50 text-red-700 px-3 py-2">{error}</p>}

      <button disabled={busy} className="btn btn-accent w-full">{busy ? "送信中…" : submitLabel}</button>
    </form>
  );
}
