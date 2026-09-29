"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { DxfViewer } from "dxf-viewer";

export type BlueprintViewerHandle = {
  /** いまの表示を PNG 画像にする (読み込み前・PDF は null) */
  capture: () => Promise<Blob | null>;
  /** 図面全体が見える表示に戻す */
  resetView: () => void;
};

type Props = {
  /** 図面ファイルの URL (期限付き)。null の間は読み込み中の表示 */
  url: string | null;
  /** PDF / PNG / JPG / JPEG / SVG / DXF */
  format: string;
  className?: string;
};

const IMAGE_TYPES: Record<string, string> = {
  PNG: "image/png",
  JPG: "image/jpeg",
  JPEG: "image/jpeg",
  SVG: "image/svg+xml",
};

/** DXF の文字を表示するフォント (日本語を含む。IPAexゴシック) */
const DXF_FONTS = ["/fonts/ipaexg.ttf"];
/** 保存するプレビュー画像の長辺 (API の上限 5MB に収める) */
const CAPTURE_MAX = 1600;

/** プレビュー画像として保存できる形式か (PDF はブラウザ内蔵のビューアで表示するため保存できない) */
export function blueprintCapturable(format: string) {
  return format.toUpperCase() !== "PDF";
}

type Shown = { kind: "pdf" | "image"; src: string };
type View = { scale: number; x: number; y: number };
const INITIAL_VIEW: View = { scale: 1, x: 0, y: 0 };

/**
 * ブラウザで DIY設計図を確認するビューア。PDF はブラウザ内蔵のビューア、画像 (PNG / JPG / SVG) は拡大・移動できる表示、
 * DXF は dxf-viewer (three.js) で描画する。
 * 期限付き URL のファイルは ActiveStorage が SVG などを application/octet-stream で返すので、取得してから正しい種類の Blob URL にして表示する
 * (SVG は <img> で表示するのでスクリプトは実行されない)
 */
export const BlueprintViewer = forwardRef<BlueprintViewerHandle, Props>(function BlueprintViewer({ url, format, className }, ref) {
  const dxfHost = useRef<HTMLDivElement>(null);
  const dxf = useRef<DxfViewer | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const kind = format.toUpperCase();

  useImperativeHandle(ref, () => ({
    capture: async () => {
      if (status !== "ready") return null;
      if (kind === "DXF") {
        const v = dxf.current;
        if (!v) return null;
        v.Render();
        return new Promise((resolve) => v.GetCanvas().toBlob((blob) => resolve(blob), "image/png"));
      }
      const img = image.current;
      return img && kind !== "PDF" ? captureImage(img) : null;
    },
    resetView: () => {
      setView(INITIAL_VIEW);
      const v = dxf.current;
      if (v) fitDxf(v);
    },
  }), [status, kind]);

  useEffect(() => {
    if (!url) return;
    let disposed = false;
    const objectUrls: string[] = [];
    const toObjectUrl = (blob: Blob) => {
      const u = URL.createObjectURL(blob);
      objectUrls.push(u);
      return u;
    };
    setStatus("loading");
    setError(null);
    setShown(null);
    setView(INITIAL_VIEW);

    (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`図面ファイルを取得できませんでした (${res.status})`);
      const data = await res.arrayBuffer();
      if (disposed) return;

      if (kind === "PDF") {
        setShown({ kind: "pdf", src: toObjectUrl(new Blob([data], { type: "application/pdf" })) });
        setStatus("ready");
      } else if (IMAGE_TYPES[kind]) {
        // 画像は <img> の読み込み完了 (onLoad) で ready にする
        setShown({ kind: "image", src: toObjectUrl(new Blob([data], { type: IMAGE_TYPES[kind] })) });
      } else if (kind === "DXF") {
        const host = dxfHost.current;
        if (!host) return;
        const [{ DxfViewer }, three] = await Promise.all([import("dxf-viewer"), import("three")]);
        if (disposed) return;
        const viewer = new DxfViewer(host, {
          autoResize: true,
          clearColor: new three.Color("#ffffff"),
          // preserveDrawingBuffer: 表示中の画像を toBlob で保存できるようにする
          preserveDrawingBuffer: true,
          fileEncoding: dxfEncoding(data),
        });
        dxf.current = viewer;
        await viewer.Load({ url: toObjectUrl(new Blob([data], { type: "text/plain" })), fonts: DXF_FONTS });
        if (disposed) return;
        setStatus("ready");
      } else {
        throw new Error(`${format} はブラウザでプレビューできません`);
      }
    })().catch((e: unknown) => {
      if (disposed) return;
      setStatus("error");
      setError(e instanceof Error ? e.message : "図面を表示できませんでした");
    });

    return () => {
      disposed = true;
      dxf.current?.Destroy();
      dxf.current = null;
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [url, format, kind]);

  // 画像: ホイールで拡大・縮小 (ページのスクロールを止めるため passive: false で登録する)
  useEffect(() => {
    const el = frame.current;
    if (!el || shown?.kind !== "image") return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => ({ ...v, scale: Math.min(8, Math.max(0.5, v.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15))) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [shown]);

  // 画像: ドラッグで移動
  const drag = useRef<{ x: number; y: number } | null>(null);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-coffee-100 bg-white ${className ?? ""}`}>
      {shown?.kind === "pdf" && <iframe src={shown.src} title="図面 (PDF)" className="absolute inset-0 h-full w-full" />}
      {shown?.kind === "image" && (
        <div
          ref={frame}
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            drag.current = { x: e.clientX, y: e.clientY };
            setView((v) => ({ ...v, x: v.x + e.clientX - d.x, y: v.y + e.clientY - d.y }));
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
        >
          <img
            ref={image}
            src={shown.src}
            alt="図面"
            draggable={false}
            onLoad={() => setStatus("ready")}
            onError={() => { setStatus("error"); setError("画像を表示できませんでした"); }}
            className="h-full w-full select-none object-contain"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          />
        </div>
      )}
      {/* DXF は dxf-viewer が canvas を差し込む (枠の大きさに合わせて自動で描き直す)。
          dxf-viewer が差し込み先の position を relative に書き換えるので、外側の枠で大きさを決める */}
      {kind === "DXF" && (
        <div className="absolute inset-0">
          <div ref={dxfHost} className="h-full w-full touch-none" />
        </div>
      )}
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-coffee-500 animate-pulse-soft">
          図面を読み込み中…
        </div>
      )}
      {status === "error" && (
        <div role="alert" className="absolute inset-0 grid place-items-center bg-white p-6 text-center text-sm text-red-700">{error}</div>
      )}
    </div>
  );
});

/** DXF R2007 以降は UTF-8。それより古いものは $DWGCODEPAGE の文字コードで、日本語の図面 (JW-CAD の出力など) は Shift_JIS が多い */
function dxfEncoding(data: ArrayBuffer) {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(data);
    return "utf-8";
  } catch {
    return "shift_jis";
  }
}

function fitDxf(v: DxfViewer) {
  const b = v.GetBounds();
  if (!b) return;
  const o = v.GetOrigin();
  v.FitView(b.minX - o.x, b.maxX - o.x, b.minY - o.y, b.maxY - o.y);
}

/** 画像を白地の PNG にする (透過 PNG・SVG の背景を白に。長辺は CAPTURE_MAX まで) */
function captureImage(img: HTMLImageElement): Promise<Blob | null> {
  const w = img.naturalWidth || 1200;
  const h = img.naturalHeight || 900;
  const ratio = Math.min(1, CAPTURE_MAX / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
