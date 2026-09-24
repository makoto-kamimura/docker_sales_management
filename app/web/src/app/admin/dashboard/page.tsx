"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen } from "@/lib/format";
import { can } from "@/lib/permissions";
import { BarList, ColumnChart } from "@/components/charts";
import type { Analytics } from "@/lib/adminTypes";

const RANGES = [
  { days: 7, label: "7日" },
  { days: 30, label: "30日" },
  { days: 90, label: "90日" },
] as const;

/** 軸・タイルは短く (12,000 → 1.2万) */
function compactYen(v: number) {
  if (v >= 10_000) return `¥${(v / 10_000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万`;
  return `¥${v.toLocaleString("ja-JP")}`;
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("sv-SE"); // YYYY-MM-DD (ローカル日付)
}

export default function AnalyticsPage() {
  const { user, token } = useAuth();
  const [days, setDays] = useState<number>(30);
  const { data, isLoading } = useSWR<Analytics>(
    token ? ["analytics", days] : null,
    () => api<Analytics>(`/admin/dashboard/sales?from=${isoDaysAgo(days - 1)}&to=${isoDaysAgo(0)}`, { auth: token }),
    { keepPreviousData: true } // 再取得中も前の表示を保つ
  );

  if (!data) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  const p = data.production;
  const stages = p.stage_hours.filter((s) => s.avg_hours != null);
  // 最も滞留している工程 (最大値が1つに定まるときだけボトルネックとして強調する)
  const maxHours = Math.max(...stages.map((s) => s.avg_hours ?? 0), 0);
  const top = stages.filter((s) => s.avg_hours === maxHours);
  const slowest = top.length === 1 && stages.length > 1 ? top[0] : null;

  return (
    <div className="space-y-6">
      {/* フィルタは1行・最上部 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">売上・分析</h1>
          <p className="text-sm text-coffee-500 mt-1">{data.from} 〜 {data.to} ・ 入金確認以降の注文が対象</p>
        </div>
        <div role="group" aria-label="期間" className="inline-flex rounded-lg border border-coffee-200 bg-white p-0.5 text-sm">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              aria-pressed={days === r.days}
              className={`rounded-md px-3 py-1.5 transition-colors ${days === r.days ? "bg-espresso text-coffee-50" : "text-coffee-600 hover:bg-coffee-100"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`space-y-6 transition-opacity ${isLoading ? "opacity-60" : ""}`}>
        {/* KPI */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Tile label="売上" value={yen(data.total_revenue_cents)} hero />
          <Tile label="注文数" value={`${data.total_orders.toLocaleString("ja-JP")} 件`} />
          <Tile label="平均注文額" value={yen(data.average_order_cents)} />
          <Tile label="リピート率" value={`${Math.round(data.customers.repeat_rate * 100)}%`}
                sub={`購入者 ${data.customers.buyers} 人中 ${data.customers.repeat_buyers} 人`} />
          <Tile label="新規会員" value={`${data.customers.new_members} 人`} />
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">日次売上</h2>
          <p className="text-xs text-coffee-500 mb-3">税・送料込み。棒にカーソルを合わせると金額と件数を表示します。</p>
          <ColumnChart
            ariaLabel="日次売上の縦棒グラフ"
            format={compactYen}
            data={data.by_day.map((d) => ({
              key: d.date, label: d.date.slice(5).replace("-", "/"), value: d.revenue_cents, detail: `${d.orders} 件`,
            }))}
          />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs text-coffee-500 hover:text-caramel">表で見る</summary>
            <div className="mt-2 max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-coffee-500"><tr><th className="py-1 text-left">日付</th><th className="py-1 text-right">売上</th><th className="py-1 text-right">件数</th></tr></thead>
                <tbody className="tabular-nums">
                  {data.by_day.map((d) => (
                    <tr key={d.date} className="border-t border-coffee-100">
                      <td className="py-1">{d.date}</td><td className="py-1 text-right">{yen(d.revenue_cents)}</td><td className="py-1 text-right">{d.orders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="font-semibold">カテゴリ別売上</h2>
            <p className="text-xs text-coffee-500 mb-4">商品代金の合計 (税・送料を除く)</p>
            <BarList data={data.by_category.map((c) => ({
              key: c.slug, label: c.name, value: c.revenue_cents, display: yen(c.revenue_cents), note: `${c.quantity} 点`,
            }))} />
          </section>

          <section className="card p-5">
            <h2 className="font-semibold">人気商品</h2>
            <p className="text-xs text-coffee-500 mb-3">期間内の商品売上 上位5件</p>
            {data.top_products.length === 0 ? <p className="text-sm text-coffee-500">データがありません</p> : (
              <table className="w-full text-sm">
                <tbody>
                  {data.top_products.map((t, i) => (
                    <tr key={t.product_id} className="border-t border-coffee-100 first:border-t-0">
                      <td className="w-6 py-2 text-coffee-400 tabular-nums">{i + 1}</td>
                      <td className="py-2 truncate">{t.name}</td>
                      <td className="py-2 text-right text-coffee-500 tabular-nums">{t.quantity} 点</td>
                      <td className="py-2 pl-3 text-right font-semibold tabular-nums">{yen(t.revenue_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        {/* 制作の見える化 */}
        <section className="card p-5 space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">制作状況</h2>
            {can(user, "production") && (
              <Link href="/admin/production" className="text-sm text-coffee-800 hover:text-caramel">制作ボードへ →</Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Tile label="進行中の注文" value={`${p.wip.reduce((n, w) => n + w.count, 0)} 件`} flat />
            <Tile label="入金→発送の平均日数" value={p.avg_lead_time_days == null ? "—" : `${p.avg_lead_time_days} 日`} flat />
            <Tile label="納期遅れ" value={`${p.overdue} 件`} warn={p.overdue > 0} flat />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">工程別の件数 (現在)</h3>
              <p className="text-xs text-coffee-500 mb-3">いまどの工程に注文が溜まっているか</p>
              <BarList data={p.wip.map((w) => ({ key: w.status, label: w.label, value: w.count, display: `${w.count} 件` }))}
                       empty="進行中の注文はありません" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">工程ごとの平均滞留時間</h3>
              <p className="text-xs text-coffee-500 mb-3">
                期間内に次の工程へ進んだ注文の平均。{slowest && <>最も時間がかかっているのは<strong className="text-coffee-800">「{slowest.label}」</strong>です。</>}
              </p>
              <BarList
                emphasize={!!slowest}
                data={stages.map((s) => ({
                  key: s.status, label: s.label, value: s.avg_hours ?? 0,
                  display: (s.avg_hours ?? 0) >= 48 ? `${Math.round((s.avg_hours ?? 0) / 24 * 10) / 10} 日` : `${s.avg_hours} 時間`,
                  note: s.status === slowest?.status ? "ボトルネック" : `${s.samples} 件`,
                  emphasis: s.status === slowest?.status,
                }))}
                empty="期間内に工程を進んだ注文はありません"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, hero, warn, flat }: {
  label: string; value: string; sub?: string; hero?: boolean; warn?: boolean; flat?: boolean;
}) {
  return (
    <div className={`${flat ? "rounded-xl border border-coffee-100 bg-coffee-50/60" : "card"} p-4 ${hero ? "col-span-2 lg:col-span-1" : ""}`}>
      <div className="text-xs font-medium text-coffee-500">{label}</div>
      <div className={`mt-1 font-bold ${hero ? "text-3xl" : "text-2xl"} ${warn ? "text-red-700" : ""}`}>
        {warn && <span aria-hidden>⚠ </span>}{value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-coffee-500">{sub}</div>}
    </div>
  );
}
