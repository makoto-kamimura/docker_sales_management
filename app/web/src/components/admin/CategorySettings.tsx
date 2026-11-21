"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api, jsonBody } from "@/lib/api";

type AdminCategory = {
  id: number;
  slug: string;
  name: string;
  label: string;
  description: string;
  position: number;
  active: boolean;
  service: boolean;
  products_count: number;
  published_products_count: number;
  deletable: boolean;
};

type Texts = { name: string; label: string; description: string };

const EMPTY_NEW = { slug: "", name: "", label: "", description: "" };

/**
 * カテゴリの設定 (販売権限)。追加・名前などの変更・販売の切り替え・▲▼ での並べ替え・削除。
 * 並び順は、店頭のメニュー・トップの「取り扱い」・検索の絞り込みに使う。
 * 止めたカテゴリの商品は、店頭の一覧・カート・注文・AIコンシェルジュの案内から外れる (商品とデータは消えない)
 */
export function CategorySettings({ token }: { token: string | null }) {
  const { data, mutate } = useSWR<AdminCategory[]>(token ? "admin-categories" : null,
    () => api<AdminCategory[]>("/admin/categories", { auth: token }));
  const { mutate: mutateGlobal } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Texts>({ name: "", label: "", description: "" });
  const [adding, setAdding] = useState(EMPTY_NEW);

  // 書き換えたあと、一覧と、カテゴリを使うほかの画面 (店頭のメニュー・商品の登録フォーム・検索) を読み直す
  async function run(action: () => Promise<unknown>, fallback: string): Promise<boolean> {
    setBusy(true);
    setErr(null);
    try {
      await action();
      await mutate();
      await Promise.all(["storefront", "admin-cats", "cats"].map((key) => mutateGlobal(key)));
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : fallback);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function toggle(c: AdminCategory) {
    void run(() => api(`/admin/categories/${c.id}`, { method: "PATCH", body: jsonBody({ active: !c.active }), auth: token }),
      "切り替えられませんでした");
  }

  function move(c: AdminCategory, direction: "up" | "down") {
    void run(() => api(`/admin/categories/${c.id}/move`, { method: "PATCH", body: jsonBody({ direction }), auth: token }),
      "並べ替えられませんでした");
  }

  function startEdit(c: AdminCategory) {
    setEditingId(c.id);
    setDraft({ name: c.name, label: c.label, description: c.description });
    setErr(null);
  }

  async function saveEdit(c: AdminCategory) {
    const ok = await run(() => api(`/admin/categories/${c.id}`, { method: "PATCH", body: jsonBody(draft), auth: token }),
      "保存できませんでした");
    if (ok) setEditingId(null);
  }

  function remove(c: AdminCategory) {
    if (!window.confirm(`カテゴリ「${c.name}」を削除します。元に戻せません。よろしいですか？`)) return;
    void run(() => api(`/admin/categories/${c.id}`, { method: "DELETE", auth: token }), "削除できませんでした");
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() => api("/admin/categories", { method: "POST", body: jsonBody(adding), auth: token }),
      "追加できませんでした");
    if (ok) setAdding(EMPTY_NEW);
  }

  const last = (data?.length ?? 0) - 1;

  return (
    <section className="card p-5">
      <h2 className="font-bold">カテゴリの設定</h2>
      <p className="mt-1 text-xs leading-relaxed text-coffee-500">
        この並び順で、店頭のメニューとトップの「取り扱い」に出ます。止めたカテゴリの商品は、店頭の一覧・カート・注文と
        AIコンシェルジュの案内から外れます（商品は消えません）。オーダーメイドを止めると、依頼の受付も休止します。
      </p>
      {err && <p role="alert" className="mt-2 text-sm text-rose-600">{err}</p>}

      <ol className="mt-4 divide-y divide-coffee-100 rounded-lg border border-coffee-200">
        {data?.map((c, i) => (
          <li key={c.id} className="px-3 py-2.5">
            <div className="flex items-center gap-3">
              <span className="flex shrink-0 flex-col">
                <button type="button" onClick={() => move(c, "up")} disabled={busy || i === 0}
                  aria-label={`${c.name}を上へ`} className="px-1 text-xs leading-none text-coffee-500 hover:text-coffee-900 disabled:opacity-25">▲</button>
                <button type="button" onClick={() => move(c, "down")} disabled={busy || i === last}
                  aria-label={`${c.name}を下へ`} className="px-1 text-xs leading-none text-coffee-500 hover:text-coffee-900 disabled:opacity-25">▼</button>
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {c.name}
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.2em] text-caramel">{c.label || c.slug}</span>
                </span>
                <span className="block truncate text-[11px] text-coffee-400">
                  {c.slug} · {c.service ? "依頼の受付" : `公開中の商品 ${c.published_products_count} 件`}
                  {c.description && ` · ${c.description}`}
                </span>
              </span>

              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs">
                <span className={c.active ? "font-semibold text-emerald-700" : "text-coffee-400"}>{c.active ? "販売中" : "停止中"}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={c.active}
                  disabled={busy}
                  onChange={() => toggle(c)}
                  aria-label={`${c.name}を${c.active ? "停止する" : "販売する"}`}
                  className="h-4 w-4 accent-[var(--color-caramel)]"
                />
              </label>

              <span className="flex shrink-0 gap-1">
                <button type="button" onClick={() => (editingId === c.id ? setEditingId(null) : startEdit(c))} disabled={busy}
                  className="btn btn-outline !py-1 !text-xs">{editingId === c.id ? "閉じる" : "編集"}</button>
                <button type="button" onClick={() => remove(c)} disabled={busy || !c.deletable}
                  title={c.deletable ? undefined : c.products_count > 0 ? "商品があるので消せません（止めることはできます）" : "システムで使うカテゴリなので消せません"}
                  className="btn btn-outline !py-1 !text-xs disabled:opacity-40">削除</button>
              </span>
            </div>

            {editingId === c.id && (
              <form onSubmit={(e) => { e.preventDefault(); void saveEdit(c); }} className="mt-3 grid gap-2 sm:grid-cols-[1fr_12rem]">
                <TextFields value={draft} onChange={setDraft} />
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <button type="submit" disabled={busy} className="btn btn-primary !py-1 !text-xs">保存</button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ol>

      <form onSubmit={add} className="mt-5 grid gap-2 sm:grid-cols-[1fr_12rem]">
        <h3 className="text-sm font-bold sm:col-span-2">カテゴリを追加</h3>
        <label className="text-xs text-coffee-500 sm:col-span-2">
          slug（URL に使う英小文字・数字・ - _。あとから変えられません）
          <input className="input mt-1" required pattern="[a-z0-9_\-]+" maxLength={40} placeholder="例：leather"
            value={adding.slug} onChange={(e) => setAdding({ ...adding, slug: e.target.value })} />
        </label>
        <TextFields value={adding} onChange={(t) => setAdding({ ...adding, ...t })} />
        <p className="text-[11px] text-coffee-400 sm:col-span-2">追加したカテゴリは「停止中」で始まります。商品を登録してから販売に切り替えてください。</p>
        <div className="flex justify-end sm:col-span-2">
          <button type="submit" disabled={busy} className="btn btn-primary">追加する</button>
        </div>
      </form>
    </section>
  );
}

/** 名前・英字の見出し・説明の入力欄 (編集と追加で共通) */
function TextFields({ value, onChange }: { value: Texts; onChange: (v: Texts) => void }) {
  return (
    <>
      <label className="text-xs text-coffee-500">
        名前
        <input className="input mt-1" required maxLength={40} placeholder="例：レザー小物"
          value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </label>
      <label className="text-xs text-coffee-500">
        英字の見出し
        <input className="input mt-1" maxLength={30} placeholder="例：LEATHER"
          value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
      </label>
      <label className="text-xs text-coffee-500 sm:col-span-2">
        ひとこと説明（トップの「取り扱い」のカードに出ます）
        <input className="input mt-1" maxLength={120} placeholder="例：手縫いのレザー小物。"
          value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </label>
    </>
  );
}
