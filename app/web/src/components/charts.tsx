"use client";

import { useRef, useState } from "react";

// 管理画面の分析用の最小限のチャート部品。
// 配色: データはアクセント1色 (--color-caramel)、強調しない系列はグレー (coffee-400)。
// どちらも白地で 3:1 以上 (dataviz の validator で確認済み)。

const ACCENT = "var(--color-caramel)";
const MUTED = "var(--color-coffee-400)";
const GRID = "var(--color-coffee-100)";

/** 0 から始まるきりの良い目盛り */
function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(v);
  return ticks;
}

export type ColumnDatum = { key: string; label: string; value: number; detail?: string };

/** 縦棒 (日次売上など)。棒ごとにホバー / フォーカスで値を表示する */
export function ColumnChart({ data, format, height = 200, ariaLabel }: {
  data: ColumnDatum[];
  format: (v: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);
  const width = 720;
  const pad = { top: 8, right: 8, bottom: 22, left: 64 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const ticks = niceTicks(Math.max(...data.map((d) => d.value), 0));
  const top = ticks[ticks.length - 1];
  const band = innerW / Math.max(data.length, 1);
  const barW = Math.min(24, band * 0.7);
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const every = Math.ceil(data.length / 8); // x 軸ラベルは最大 8 個に間引く

  function show(i: number) {
    const el = wrap.current;
    if (!el) return;
    setHover({ i, x: ((pad.left + band * i + band / 2) / width) * el.clientWidth });
  }

  return (
    <div ref={wrap} className="relative" onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-coffee-500 text-[11px] tabular-nums">
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + band * i + (band - barW) / 2;
          const yTop = y(d.value);
          const h = Math.max(0, y(0) - yTop);
          const r = Math.min(4, h, barW / 2);
          return (
            <g key={d.key}>
              {/* 先端だけ 4px の丸み、根元は四角 */}
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${y(0)} Z`}
                  fill={ACCENT}
                  opacity={hover && hover.i !== i ? 0.55 : 1}
                />
              )}
              {i % every === 0 && (
                <text x={pad.left + band * i + band / 2} y={height - 6} textAnchor="middle" className="fill-coffee-500 text-[11px]">
                  {d.label}
                </text>
              )}
              {/* 当たり判定は棒より大きく (列全体) */}
              <rect
                x={pad.left + band * i} y={pad.top} width={band} height={innerH} fill="transparent"
                tabIndex={0} aria-label={`${d.label} ${format(d.value)}${d.detail ? ` ${d.detail}` : ""}`}
                onPointerEnter={() => show(i)} onFocus={() => show(i)} onBlur={() => setHover(null)}
                className="outline-none"
              />
            </g>
          );
        })}
        <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke="var(--color-coffee-300)" strokeWidth={1} />
      </svg>
      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-coffee-200 bg-white px-3 py-2 text-xs shadow-lift"
          style={{ left: hover.x }}
        >
          <div className="text-sm font-bold tabular-nums">{format(data[hover.i].value)}</div>
          <div className="text-coffee-500">{data[hover.i].label}{data[hover.i].detail ? ` · ${data[hover.i].detail}` : ""}</div>
        </div>
      )}
    </div>
  );
}

export type BarDatum = { key: string; label: string; value: number; display: string; note?: string; emphasis?: boolean };

/**
 * 横棒 (カテゴリ別・工程別など)。値は棒の先に表示する。
 * `emphasize` を指定すると emphasis の行だけアクセント色、他はグレーにする (ボトルネックの強調など)。
 */
export function BarList({ data, emphasize = false, empty = "データがありません" }: {
  data: BarDatum[];
  emphasize?: boolean;
  empty?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  if (data.length === 0 || max === 0) return <p className="text-sm text-coffee-500">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.key} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr]">
          <span className="truncate text-coffee-700" title={d.label}>{d.label}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="h-3 shrink-0 rounded-r-[4px]"
              style={{
                width: `${Math.max((d.value / max) * 60, d.value > 0 ? 1 : 0)}%`, // 残りは値と注記のため
                background: emphasize && !d.emphasis ? MUTED : ACCENT,
              }}
            />
            <span className="shrink-0 tabular-nums font-semibold text-coffee-800">{d.display}</span>
            {d.note && <span className="min-w-0 truncate text-xs text-coffee-500" title={d.note}>{d.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
