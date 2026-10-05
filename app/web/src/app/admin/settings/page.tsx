"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate } from "@/lib/format";

type ShopSetting = {
  seller_name: string;
  representative_name: string;
  address: string;
  phone: string;
  email: string;
  disclose_on_request: boolean;
  contact_hours: string;
  transfer_payment_due: string;
  shipping_lead_time: string;
  returns_policy: string;
  extra_notes: string;
  complete: boolean;
  updated_at: string;
};

type Form = Omit<ShopSetting, "complete" | "updated_at">;

const FORM_KEYS: (keyof Form)[] = [
  "seller_name", "representative_name", "address", "phone", "email", "disclose_on_request", "contact_hours",
  "transfer_payment_due", "shipping_lead_time", "returns_policy", "extra_notes",
];

const SELLER_FIELDS: { key: keyof Form; label: string; placeholder?: string; type?: string }[] = [
  { key: "seller_name", label: "販売事業者名", placeholder: "屋号または氏名・法人名" },
  { key: "representative_name", label: "運営統括責任者" },
  { key: "email", label: "メールアドレス", type: "email" },
  { key: "contact_hours", label: "電話の受付時間（任意）", placeholder: "例：平日 10:00〜17:00" },
];

const POLICY_FIELDS: { key: keyof Form; label: string; note: string; rows: number }[] = [
  { key: "transfer_payment_due", label: "銀行振込の支払期限", note: "表記の「お支払い時期」と、注文確認画面に出します", rows: 2 },
  { key: "shipping_lead_time", label: "発送の目安（3Dプリント品・ハンドメイド・素材）", note: "表記の「商品の引渡し時期」と、注文確認画面に出します", rows: 2 },
  { key: "returns_policy", label: "返品・交換・キャンセル", note: "表記と、注文確認画面のリンク先に出します", rows: 6 },
  { key: "extra_notes", label: "その他（任意）", note: "表記の最後に出します", rows: 3 },
];

// ショップ情報 (管理者のみ): 特定商取引法に基づく表記の販売者の情報と、店舗の方針の文面。
// 送料・税率・支払方法・定期便のプランは、実際の計算に使う値から自動で表示する
export default function ShopSettingsPage() {
  const { token } = useAuth();
  const { data, mutate } = useSWR<ShopSetting>(token ? "admin-shop-setting" : null,
    () => api<ShopSetting>("/admin/shop_setting", { auth: token }));
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (data && !form) setForm(Object.fromEntries(FORM_KEYS.map((k) => [k, data[k]])) as Form);
  }, [data, form]);

  if (!data || !form) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm({ ...form, [key]: value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const updated = await api<ShopSetting>("/admin/shop_setting", { method: "PATCH", body: jsonBody(form), auth: token });
      mutate(updated, { revalidate: false });
      setMsg({ ok: true, text: "保存しました" });
    } catch (e2) {
      setMsg({ ok: false, text: e2 instanceof Error ? e2.message : "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ショップ情報</h1>
          <p className="mt-1 text-sm text-coffee-500">
            特定商取引法に基づく表記に載せる販売者の情報と、店舗の方針です。最終更新：{fmtDate(data.updated_at)}
          </p>
        </div>
        <a href="/legal/tokushoho" target="_blank" rel="noopener" className="btn btn-outline !text-xs">公開ページを開く ↗</a>
      </div>

      {!data.complete && (
        <p role="status" className="rounded-xl border border-caramel/40 bg-caramel/5 px-4 py-3 text-sm text-coffee-700">
          表記に必要な項目が足りません。販売事業者名・運営統括責任者・メールアドレス・所在地と電話番号（または「請求があれば開示」）・方針の3項目を入力してください。
        </p>
      )}

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">販売者</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SELLER_FIELDS.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="text-coffee-600">{f.label}</span>
              <input type={f.type ?? "text"} value={String(form[f.key])} placeholder={f.placeholder}
                     onChange={(e) => set(f.key, e.target.value)} className="input mt-1" />
            </label>
          ))}
        </div>

        <fieldset className="space-y-2 text-sm">
          <legend className="text-coffee-600 mb-1">所在地・電話番号の掲載</legend>
          {([
            [false, "掲載する"],
            [true, "掲載せず「請求があった場合には遅滞なく開示します」と表示する（個人の販売者向け）"],
          ] as const).map(([value, label]) => (
            <label key={String(value)} className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="disclose" checked={form.disclose_on_request === value}
                     onChange={() => set("disclose_on_request", value)} className="mt-1 accent-caramel" />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm sm:col-span-2">
            <span className="text-coffee-600">所在地</span>
            <input value={form.address} onChange={(e) => set("address", e.target.value)} className="input mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-coffee-600">電話番号</span>
            <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input mt-1" />
          </label>
        </div>
        {form.disclose_on_request && (
          <p className="text-xs text-coffee-500">
            所在地・電話番号は公開ページにも API にも出しません。開示の請求に答えられるよう、控えとして入力しておけます。
          </p>
        )}
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">店舗の方針</h2>
        {POLICY_FIELDS.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="text-coffee-600">{f.label}</span>
            <span className="block text-xs text-coffee-400">{f.note}</span>
            <textarea rows={f.rows} value={String(form[f.key])} onChange={(e) => set(f.key, e.target.value)} className="input mt-1" />
          </label>
        ))}
        <p className="text-xs text-coffee-400">
          送料・消費税・支払方法・定期便のプラン・投げ銭の金額は、実際の計算に使う値から自動で表示します。
          公開した内容が法令の求めに合っているかは、店舗で確認してください。
        </p>
      </section>

      <div className="flex items-center gap-3">
        <button disabled={saving} className="btn btn-primary">{saving ? "保存中…" : "保存する"}</button>
        {msg && <span role="status" className={`text-sm ${msg.ok ? "text-[#1f7a46]" : "text-rose-600"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
