"use client";

import { useState } from "react";
import { api, jsonBody } from "@/lib/api";
import { fmtDate, yen } from "@/lib/format";
import type { Tip } from "@/lib/types";

const PRESETS = [100, 300, 500, 1_000];
const MIN = 100;
const MAX = 100_000;

/** 投げ銭 (0円で販売した商品を含む注文)。カード決済はせず、入金は店舗が確認する */
export function TipBox({ orderId, tips, token, onChange }: {
  orderId: number;
  tips: Tip[];
  token: string | null;
  onChange: () => void;
}) {
  const [preset, setPreset] = useState(300);
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const amount = custom ? Number(custom) : preset;
  const valid = Number.isInteger(amount) && amount >= MIN && amount <= MAX;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setErr(null);
    setBusy(true);
    try {
      await api(`/orders/${orderId}/tips`, { method: "POST", body: jsonBody({ amount_cents: amount, message }), auth: token });
      setSent(true);
      setCustom("");
      setMessage("");
      onChange();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "送信に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(tip: Tip) {
    if (!window.confirm(`${yen(tip.amount_cents)} の投げ銭を取り消しますか？`)) return;
    setErr(null);
    try {
      await api(`/orders/${orderId}/tips/${tip.id}`, { method: "DELETE", auth: token });
      setSent(false);
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "取り消しに失敗しました");
    }
  }

  return (
    <section aria-labelledby="tip-heading" className="space-y-4 rounded-2xl border border-caramel/30 bg-caramel/5 p-5">
      <div>
        <h2 id="tip-heading" className="font-semibold">☕ 投げ銭で応援する</h2>
        <p className="mt-1 text-xs leading-relaxed text-coffee-600">
          この注文には無料でお届けした作品が含まれています。気に入っていただけたら、お好きな金額で制作を応援していただけるとうれしいです (任意)。
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="金額">
          {PRESETS.map((p) => {
            const selected = !custom && preset === p;
            return (
              <button
                key={p}
                type="button"
                aria-pressed={selected}
                onClick={() => { setPreset(p); setCustom(""); }}
                className={`rounded-full border px-4 py-1.5 text-sm tabular-nums transition-colors ${
                  selected ? "border-caramel bg-caramel text-white" : "border-coffee-200 bg-white hover:border-caramel"
                }`}
              >
                {yen(p)}
              </button>
            );
          })}
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-coffee-500">その他</span>
            <input type="number" inputMode="numeric" min={MIN} max={MAX} step={1} value={custom}
                   onChange={(e) => setCustom(e.target.value)} placeholder="金額" aria-label="金額を入力 (円)"
                   className="input !w-28 !py-1.5" />
            <span className="text-coffee-500">円</span>
          </label>
        </div>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={2}
                  placeholder="メッセージ (任意)" aria-label="メッセージ" className="input" />
        {custom && !valid && <p className="text-xs text-rose-600">100〜100,000円の整数で入力してください</p>}
        {err && <p role="alert" className="text-sm text-rose-600">{err}</p>}
        {sent && (
          <p role="status" className="rounded-lg bg-white px-3 py-2 text-sm text-coffee-700">
            ありがとうございます！ お支払い方法 (振込先など) はショップからご連絡します。
          </p>
        )}
        <button disabled={!valid || busy} className="btn btn-accent">
          {busy ? "送信中…" : valid ? `${yen(amount)} を投げ銭する` : "投げ銭する"}
        </button>
      </form>

      {tips.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold text-coffee-500">これまでの投げ銭</h3>
          <ul className="divide-y divide-coffee-100 rounded-xl bg-white text-sm">
            {tips.map((t) => (
              <li key={t.id} className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold tabular-nums">{yen(t.amount_cents)}</span>
                  <TipStatusBadge tip={t} />
                  <span className="text-xs text-coffee-400">{fmtDate(t.created_at)}</span>
                  {t.status === "pending" && (
                    <button type="button" onClick={() => cancel(t)} className="ml-auto text-xs text-coffee-500 hover:text-rose-600">取り消す</button>
                  )}
                </div>
                {t.message && <p className="mt-0.5 whitespace-pre-line text-xs text-coffee-600">{t.message}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function TipStatusBadge({ tip }: { tip: Pick<Tip, "status" | "status_label"> }) {
  const cls = tip.status === "paid" ? "badge-success" : tip.status === "cancelled" ? "bg-coffee-100 text-coffee-500" : "badge-accent";
  return <span className={`badge ${cls}`}>{tip.status_label}</span>;
}
