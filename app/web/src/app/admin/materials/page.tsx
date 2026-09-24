"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen } from "@/lib/format";
import type { Material, Recipe } from "@/lib/adminTypes";
import type { Product } from "@/lib/types";

const num = (n: number) => n.toLocaleString("ja-JP", { maximumFractionDigits: 2 });

export default function MaterialsPage() {
  const { token } = useAuth();
  const { data: materials, mutate } = useSWR<Material[]>(token ? "materials" : null,
    () => api<Material[]>("/admin/materials", { auth: token }));
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", unit: "g", stock: 0, reorder_point: 0, unit_cost_cents: 0, supplier: "" });

  async function call(path: string, method: string, body?: unknown) {
    setErr(null);
    try {
      await api(path, { method, body: body === undefined ? undefined : jsonBody(body), auth: token });
      mutate();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
      return false;
    }
  }

  if (!materials) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  // 在庫 - 制作待ち注文の使用予定 が発注点を下回るものも「要発注」とみなす
  const needsOrder = (m: Material) => m.low || m.projected_stock <= m.reorder_point;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">材料管理</h1>
        <p className="text-sm text-coffee-500 mt-1">
          注文が「制作中」になると、商品のレシピに従って材料が自動で差し引かれます。
          「使用予定」は入金確認・制作待ちの注文でこれから使う量です。
        </p>
      </div>
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[52rem]">
          <thead className="bg-coffee-50 text-xs uppercase tracking-wide text-coffee-500">
            <tr>
              <th className="p-3 text-left font-semibold">材料</th>
              <th className="p-3 text-right font-semibold">在庫</th>
              <th className="p-3 text-right font-semibold">使用予定</th>
              <th className="p-3 text-right font-semibold">見込み</th>
              <th className="p-3 text-right font-semibold">発注点</th>
              <th className="p-3 text-left font-semibold">状態</th>
              <th className="p-3 text-left font-semibold">入荷・調整</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id} className="border-t border-coffee-100 align-top">
                <td className="p-3">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-coffee-400">
                    {m.code}{m.supplier && ` · ${m.supplier}`}{m.unit_cost_cents > 0 && ` · ${yen(m.unit_cost_cents)}/${m.unit}`}
                  </div>
                  {m.products.length > 0 && (
                    <div className="text-xs text-coffee-500 mt-0.5">使用: {m.products.map((p) => p.name).join("、")}</div>
                  )}
                </td>
                <td className={`p-3 text-right tabular-nums font-semibold ${m.stock < 0 ? "text-red-600" : ""}`}>{num(m.stock)} {m.unit}</td>
                <td className="p-3 text-right tabular-nums text-coffee-600">{m.required_for_queue > 0 ? `${num(m.required_for_queue)} ${m.unit}` : "—"}</td>
                <td className="p-3 text-right tabular-nums text-coffee-600">{num(m.projected_stock)} {m.unit}</td>
                <td className="p-3 text-right tabular-nums text-coffee-500">{num(m.reorder_point)} {m.unit}</td>
                <td className="p-3">
                  {needsOrder(m)
                    ? <span className="badge bg-amber-100 text-amber-900">⚠ 要発注</span>
                    : <span className="badge badge-success">✓ 充足</span>}
                </td>
                <td className="p-3">
                  <AdjustForm unit={m.unit} onSubmit={(delta) => call(`/admin/materials/${m.id}/adjust`, "POST", { delta })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold mb-3">材料を追加</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await call("/admin/materials", "POST", form)) setForm({ ...form, code: "", name: "", stock: 0 });
            }}
            className="grid grid-cols-2 gap-3 text-sm"
          >
            <input required placeholder="コード (例: MTL-ABS)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input" />
            <input required placeholder="名前" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
            <label className="block"><span className="field-label">単位</span>
              <input required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input" /></label>
            <label className="block"><span className="field-label">初期在庫</span>
              <input type="number" step="any" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} className="input" /></label>
            <label className="block"><span className="field-label">発注点</span>
              <input type="number" step="any" value={form.reorder_point} onChange={(e) => setForm({ ...form, reorder_point: Number(e.target.value) })} className="input" /></label>
            <label className="block"><span className="field-label">単価 (円/単位)</span>
              <input type="number" value={form.unit_cost_cents} onChange={(e) => setForm({ ...form, unit_cost_cents: Number(e.target.value) })} className="input" /></label>
            <input placeholder="仕入先" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="input col-span-2" />
            <button className="btn btn-primary col-span-2">追加</button>
          </form>
        </section>

        <RecipeEditor materials={materials} token={token} onSaved={() => mutate()} onError={setErr} />
      </div>
    </div>
  );
}

function AdjustForm({ unit, onSubmit }: { unit: string; onSubmit: (delta: number) => Promise<boolean> }) {
  const [delta, setDelta] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (delta && (await onSubmit(Number(delta)))) setDelta("");
      }}
      className="flex items-center gap-1.5"
    >
      <input type="number" step="any" value={delta} onChange={(e) => setDelta(e.target.value)}
             aria-label={`増減 (${unit})`} placeholder="+入荷 / -廃棄" className="input !w-28 !py-1 !text-xs" />
      <button disabled={!delta} className="btn btn-outline !py-1 !px-2.5 text-xs">反映</button>
    </form>
  );
}

// 商品1個あたりに使う材料 (レシピ)
function RecipeEditor({ materials, token, onSaved, onError }: {
  materials: Material[]; token: string | null; onSaved: () => void; onError: (m: string | null) => void;
}) {
  // 制作が必要な物販品 (デジタル商品・オーダーメイドは除く)
  const { data: products } = useSWR<Product[]>("recipe-products", () => api<Product[]>("/products?per=100"));
  const makeable = products?.filter((p) => !p.is_digital && p.category_slug !== "custom") ?? [];
  const [productId, setProductId] = useState("");
  const [rows, setRows] = useState<{ material_id: number; quantity: number }[]>([]);
  const [saved, setSaved] = useState(false);

  async function load(id: string) {
    setProductId(id); setSaved(false);
    if (!id) { setRows([]); return; }
    const r = await api<Recipe>(`/admin/products/${id}/materials`, { auth: token });
    setRows(r.items.map((i) => ({ material_id: i.material_id, quantity: i.quantity })));
  }

  async function save() {
    onError(null);
    try {
      await api(`/admin/products/${productId}/materials`, {
        method: "PUT", body: jsonBody({ items: rows.filter((r) => r.material_id && r.quantity > 0) }), auth: token,
      });
      setSaved(true);
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "エラー");
    }
  }

  return (
    <section className="card p-5 space-y-3 text-sm">
      <h2 className="font-semibold">レシピ (1個あたりの使用材料)</h2>
      <select value={productId} onChange={(e) => load(e.target.value)} className="input">
        <option value="">商品を選択</option>
        {makeable.map((p) => <option key={p.id} value={p.id}>{p.sku} {p.name}</option>)}
      </select>
      {productId && (
        <>
          <ul className="space-y-2">
            {rows.map((r, i) => {
              const unit = materials.find((m) => m.id === r.material_id)?.unit ?? "";
              return (
                <li key={i} className="flex items-center gap-2">
                  <select value={r.material_id} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, material_id: Number(e.target.value) } : x)))}
                          className="input flex-1">
                    <option value={0}>材料を選択</option>
                    {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <input type="number" step="any" min={0} value={r.quantity} aria-label="数量"
                         onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))}
                         className="input !w-24" />
                  <span className="w-6 text-coffee-500">{unit}</span>
                  <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}
                          className="text-xs text-rose-500 hover:underline">削除</button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setRows([...rows, { material_id: 0, quantity: 1 }])}
                    className="text-sm text-caramel hover:underline">+ 材料を追加</button>
            <div className="flex items-center gap-3">
              {saved && <span className="text-xs text-emerald-700">保存しました</span>}
              <button type="button" onClick={save} className="btn btn-primary">保存</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
