"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { ModelViewer, type ModelViewerHandle } from "@/components/ModelViewer";

/** 一度に並べる数の上限 (ビューアごとに WebGL を使うので、ブラウザの上限と描画負荷を考えて抑える) */
export const MODEL_GRID_MAX = 9;

const GAP_COLOR = "#dededa"; // coffee-200 (区切り線)

export type ModelGridItem = {
  key: string | number;
  /** モデルファイルの URL (期限付き)。null の間は読み込み中の表示 */
  url: string | null;
  format: string;
  label: string;
};

type Props = {
  items: ModelGridItem[];
  /** セルのファイル名を押したとき (単体表示に切り替える) */
  onSelect?: (index: number) => void;
  className?: string;
};

/** n 件を画面枠に収まるよう分割する (4件 → 2×2、6件 → 3×2、9件 → 3×3) */
export function gridShape(n: number) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  return { cols, rows: Math.max(1, Math.ceil(n / cols)) };
}

/** 版の全ファイルを1つの枠に分割して並べる 3D プレビュー。操作 (向き・視点・画像保存) は全セルにまとめてかかる */
export const ModelViewerGrid = forwardRef<ModelViewerHandle, Props>(function ModelViewerGrid({ items, onSelect, className }, ref) {
  const viewers = useRef<(ModelViewerHandle | null)[]>([]);
  const { cols, rows } = gridShape(items.length);

  useImperativeHandle(ref, () => ({
    // 各セルの表示を画面と同じ並びで1枚の画像にまとめる
    capture: async () => {
      const blobs = await Promise.all(items.map((_, i) => viewers.current[i]?.capture() ?? Promise.resolve(null)));
      if (blobs.length === 0 || blobs.some((b) => !b)) return null;
      const images = await Promise.all(blobs.map((b) => createImageBitmap(b as Blob)));
      const w = Math.max(...images.map((img) => img.width));
      const h = Math.max(...images.map((img) => img.height));
      const gap = Math.max(2, Math.round(w / 160));
      const canvas = document.createElement("canvas");
      canvas.width = cols * w + (cols - 1) * gap;
      canvas.height = rows * h + (rows - 1) * gap;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = GAP_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      images.forEach((img, i) => {
        ctx.drawImage(img, (i % cols) * (w + gap), Math.floor(i / cols) * (h + gap), w, h);
        img.close();
      });
      return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
    },
    rotate: () => viewers.current.forEach((v) => v?.rotate()),
    resetView: () => viewers.current.forEach((v) => v?.resetView()),
  }), [items, cols, rows]);

  return (
    <div
      className={`grid gap-1 overflow-hidden rounded-xl bg-coffee-200 ${className ?? ""}`}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {items.map((item, i) => (
        <div key={item.key} className="relative min-h-0 min-w-0">
          <ModelViewer
            ref={(h) => { viewers.current[i] = h; }}
            url={item.url}
            format={item.format}
            className="!absolute inset-0 !rounded-none"
          />
          <button
            type="button"
            onClick={() => onSelect?.(i)}
            title={`${item.label} を単体で表示`}
            className="absolute left-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-md bg-white/85 px-1.5 py-0.5 text-[11px] text-coffee-700 shadow-sm hover:text-caramel"
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
});
