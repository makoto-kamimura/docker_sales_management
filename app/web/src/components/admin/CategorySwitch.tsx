"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api, jsonBody } from "@/lib/api";

type AdminCategory = {
  id: number;
  slug: string;
  name: string;
  active: boolean;
  service: boolean;
  published_products_count: number;
};

/**
 * 販売するカテゴリの切り替え (販売権限)。止めたカテゴリの商品は、店頭の一覧・カート・注文・
 * AIコンシェルジュの案内から外れ、メニューの項目 (オーダーメイドなど) も消える。商品とデータは消えない
 */
export function CategorySwitch({ token }: { token: string | null }) {
  const { data, mutate } = useSWR<AdminCategory[]>(token ? "admin-categories" : null,
    () => api<AdminCategory[]>("/admin/categories", { auth: token }));
  const { mutate: mutateGlobal } = useSWRConfig();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(c: AdminCategory) {
    setBusyId(c.id);
    setErr(null);
    try {
      await api(`/admin/categories/${c.id}`, { method: "PATCH", body: jsonBody({ active: !c.active }), auth: token });
      await mutate();
      await mutateGlobal("storefront");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "切り替えられませんでした");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="font-bold">販売するカテゴリ</h2>
      <p className="mt-1 text-xs leading-relaxed text-coffee-500">
        止めたカテゴリの商品は、店頭の一覧・カート・注文と AIコンシェルジュの案内から外れます（商品は消えません）。
        オーダーメイドを止めると、依頼の受付も休止します。
      </p>
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-coffee-200 px-3 py-2.5 hover:border-coffee-400">
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{c.name}</span>
                <span className="block text-[11px] text-coffee-400">
                  {c.service ? "依頼の受付" : `公開中の商品 ${c.published_products_count} 件`}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                <span className={c.active ? "font-semibold text-emerald-700" : "text-coffee-400"}>{c.active ? "販売中" : "停止中"}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={c.active}
                  disabled={busyId !== null}
                  onChange={() => void toggle(c)}
                  aria-label={`${c.name}を${c.active ? "停止する" : "販売する"}`}
                  className="h-4 w-4 accent-[var(--color-caramel)]"
                />
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
