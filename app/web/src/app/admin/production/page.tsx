"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen } from "@/lib/format";
import { can } from "@/lib/permissions";
import { ORDER_FLOW, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orderStatus";
import type { OrderCard, ProductionBoard } from "@/lib/adminTypes";

// 制作工程の列 (見た目で強調する)
const PRODUCTION = new Set<OrderStatus>(["awaiting_production", "in_production", "inspection", "ready_to_ship"]);

type ShipDialog = { order: OrderCard; carrier: string; tracking: string } | null;

export default function ProductionBoardPage() {
  const { user, token } = useAuth();
  const [assignee, setAssignee] = useState(""); // "" = 全員
  const { data: board, mutate } = useSWR<ProductionBoard>(
    token ? ["production", assignee] : null,
    () => api<ProductionBoard>(`/admin/production${assignee ? `?assignee_id=${assignee}` : ""}`, { auth: token }),
    { refreshInterval: 30_000 } // 他のスタッフの更新も反映
  );
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<OrderStatus | null>(null);
  const [ship, setShip] = useState<ShipDialog>(null);
  const [openCard, setOpenCard] = useState<number | null>(null);

  async function update(order: OrderCard, body: Record<string, unknown>) {
    setError(null);
    try {
      await api(`/admin/production/${order.id}`, { method: "PATCH", body: jsonBody(body), auth: token });
    } catch (e) {
      setError(`#${order.id}: ${e instanceof Error ? e.message : "更新に失敗しました"}`);
    }
    mutate();
  }

  function move(order: OrderCard, status: OrderStatus) {
    if (status === order.status) return;
    // 発送済みへは配送情報を添える
    if (status === "shipped" && !order.digital_only) {
      setShip({ order, carrier: "", tracking: "" });
      return;
    }
    // 画面を先に動かしてから保存 (失敗したら再取得で元に戻る)
    mutate(
      (b) => b && {
        ...b,
        columns: b.columns.map((c) => ({
          ...c,
          orders: c.status === status
            ? [...c.orders.filter((o) => o.id !== order.id), { ...order, status }]
            : c.orders.filter((o) => o.id !== order.id),
        })),
      },
      { revalidate: false }
    );
    update(order, { status });
  }

  function findOrder(id: number) {
    return board?.columns.flatMap((c) => c.orders).find((o) => o.id === id);
  }

  if (!board) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  const total = board.columns.reduce((n, c) => n + (c.status === "completed" ? 0 : c.orders.length), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">制作ボード</h1>
          <p className="text-sm text-coffee-500 mt-1">
            進行中 {total} 件。カードをドラッグするか ◀ ▶ で工程を移動します。
          </p>
        </div>
        <div className="flex items-end gap-2 text-sm">
          <div>
            <span className="field-label">製作担当</span>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="input !w-auto">
              <option value="">全員</option>
              {user && <option value={user.id}>自分の担当</option>}
              {board.staff.filter((s) => s.id !== user?.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {board.low_materials.length > 0 && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <span aria-hidden>⚠ </span>
          発注点を下回っている材料: {board.low_materials.map((m) => `${m.name}（残 ${m.stock}${m.unit}）`).join("、")}
          <Link href="/admin/materials" className="ml-2 font-medium underline">材料管理へ</Link>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {board.columns.map((col) => (
            <section
              key={col.status}
              aria-label={col.label}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.status); }}
              onDragLeave={() => setDragOver((s) => (s === col.status ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const order = findOrder(Number(e.dataTransfer.getData("text/plain")));
                if (order) move(order, col.status);
              }}
              className={`flex w-60 shrink-0 flex-col rounded-xl border p-2 transition-colors ${
                dragOver === col.status ? "border-caramel bg-caramel/5"
                  : PRODUCTION.has(col.status) ? "border-coffee-200 bg-white" : "border-coffee-100 bg-coffee-50"
              }`}
            >
              <header className="flex items-center justify-between px-1.5 pb-2 pt-1">
                <h2 className="text-sm font-bold">
                  {PRODUCTION.has(col.status) && <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full bg-caramel" />}
                  {col.label}
                </h2>
                <span className="rounded-full bg-coffee-100 px-2 py-0.5 text-xs tabular-nums text-coffee-600">{col.orders.length}</span>
              </header>
              <ul className="flex min-h-24 flex-col gap-2">
                {col.orders.map((o) => (
                  <Card
                    key={o.id}
                    order={o}
                    staff={board.staff}
                    open={openCard === o.id}
                    canOpenOrder={can(user, "orders")}
                    onToggle={() => setOpenCard(openCard === o.id ? null : o.id)}
                    onMove={(s) => move(o, s)}
                    onPlan={(body) => update(o, body)}
                  />
                ))}
                {col.orders.length === 0 && <li className="px-1.5 py-3 text-center text-xs text-coffee-300">なし</li>}
              </ul>
            </section>
          ))}
        </div>
      </div>

      {ship && (
        <div role="dialog" aria-modal="true" aria-label="発送情報" className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4">
          <form
            className="card w-full max-w-sm space-y-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              update(ship.order, { status: "shipped", carrier: ship.carrier, tracking_number: ship.tracking });
              setShip(null);
            }}
          >
            <h2 className="font-bold">#{ship.order.id} を発送済みにする</h2>
            <div>
              <label className="field-label" htmlFor="ship-carrier">配送業者</label>
              <input id="ship-carrier" autoFocus value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })}
                     className="input" placeholder="例: ヤマト運輸" />
            </div>
            <div>
              <label className="field-label" htmlFor="ship-tracking">追跡番号</label>
              <input id="ship-tracking" value={ship.tracking} onChange={(e) => setShip({ ...ship, tracking: e.target.value })} className="input" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShip(null)} className="btn btn-outline">キャンセル</button>
              <button className="btn btn-primary">発送済みにする</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Card({ order: o, staff, open, canOpenOrder, onToggle, onMove, onPlan }: {
  order: OrderCard;
  staff: ProductionBoard["staff"];
  open: boolean;
  canOpenOrder: boolean; // 注文権限があれば注文詳細へリンク
  onToggle: () => void;
  onMove: (s: OrderStatus) => void;
  onPlan: (body: Record<string, unknown>) => void;
}) {
  const idx = ORDER_FLOW.indexOf(o.status as (typeof ORDER_FLOW)[number]);
  const prev = idx > 0 ? ORDER_FLOW[idx - 1] : null;
  const next = idx >= 0 && idx < ORDER_FLOW.length - 1 ? ORDER_FLOW[idx + 1] : null;
  const shown = o.items.slice(0, 2);

  return (
    <li
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(o.id)); e.dataTransfer.effectAllowed = "move"; }}
      className={`cursor-grab rounded-lg border bg-white p-2.5 text-xs shadow-soft active:cursor-grabbing ${
        o.overdue ? "border-red-300" : "border-coffee-200"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {canOpenOrder ? (
          <Link href={`/admin/orders/${o.id}`} className="text-sm font-bold hover:text-caramel">#{o.id}</Link>
        ) : (
          <span className="text-sm font-bold">#{o.id}</span>
        )}
        <span className="truncate text-coffee-500">{o.user.name}</span>
      </div>
      <ul className="mt-1.5 space-y-0.5 text-coffee-700">
        {shown.map((i) => (
          <li key={i.product_id} className="truncate">{i.is_digital ? "⬇ " : ""}{i.name} ×{i.quantity}</li>
        ))}
        {o.items.length > shown.length && <li className="text-coffee-400">他 {o.items.length - shown.length} 点</li>}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {o.due_on && (
          <span className={`rounded px-1.5 py-0.5 ${o.overdue ? "bg-red-50 font-semibold text-red-700" : "bg-coffee-50 text-coffee-600"}`}>
            {o.overdue ? "納期遅れ " : "納期 "}{o.due_on.slice(5).replace("-", "/")}
          </span>
        )}
        {o.digital_only && <span className="rounded bg-coffee-50 px-1.5 py-0.5 text-coffee-600">データのみ</span>}
        <span className="ml-auto flex items-center gap-1 text-coffee-500" title="製作担当">
          <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
            o.assignee ? "bg-espresso text-white" : "border border-dashed border-coffee-300 text-coffee-300"
          }`}>
            {o.assignee ? o.assignee.name.slice(0, 1) : "?"}
          </span>
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-coffee-100 pt-1.5">
        <button type="button" disabled={!prev} onClick={() => prev && onMove(prev)}
                aria-label={prev ? `${ORDER_STATUS_LABEL[prev]}へ戻す` : undefined}
                className="rounded px-1.5 py-0.5 text-coffee-500 hover:bg-coffee-100 disabled:invisible">◀</button>
        <button type="button" onClick={onToggle} aria-expanded={open}
                className="rounded px-1.5 py-0.5 text-coffee-500 hover:bg-coffee-100">{open ? "閉じる" : "担当・納期"}</button>
        <button type="button" disabled={!next} onClick={() => next && onMove(next)}
                aria-label={next ? `${ORDER_STATUS_LABEL[next]}へ進める` : undefined}
                className="rounded px-1.5 py-0.5 text-coffee-500 hover:bg-coffee-100 disabled:invisible">▶</button>
      </div>

      {open && (
        <div className="mt-2 space-y-2 border-t border-coffee-100 pt-2">
          <label className="block">
            <span className="text-[11px] text-coffee-500">製作担当</span>
            <select value={o.assignee?.id ?? ""} onChange={(e) => onPlan({ assignee_id: e.target.value || null })}
                    className="input !py-1 !text-xs">
              <option value="">未割り当て</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] text-coffee-500">納期</span>
            <input type="date" defaultValue={o.due_on ?? ""} onBlur={(e) => { if (e.target.value !== (o.due_on ?? "")) onPlan({ due_on: e.target.value || null }); }}
                   className="input !py-1 !text-xs" />
          </label>
          <div className="text-[11px] text-coffee-400">合計 {yen(o.total_cents)}</div>
        </div>
      )}
    </li>
  );
}
