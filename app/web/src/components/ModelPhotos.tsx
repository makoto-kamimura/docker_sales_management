"use client";

import { useState } from "react";
import { api, jsonBody } from "@/lib/api";
import { shrinkPhoto } from "@/lib/photos";
import { PhotoStrip } from "./PhotoStrip";
import type { ModelAssetDetail, ModelPhoto } from "@/lib/adminTypes";

const KINDS: { key: ModelPhoto["kind"]; label: string; hint: string }[] = [
  { key: "real_model", label: "実モデル画像", hint: "出力・組み立てた実物の写真" },
  { key: "in_use", label: "実利用画像", hint: "実際に使っている様子の写真" },
];
const MAX_FEATURED = 3;

type Call = (key: string, path: string, init: RequestInit) => Promise<boolean>;

/** 3Dモデルの写真 (実モデル画像 / 実利用画像)。★ を付けた最大3枚を一覧・ショップの商品ページでプレビュー表示する */
export function ModelPhotos({ base, token, name, photos, onUpdated }: {
  base: string;
  token: string | null;
  name: string;
  photos: ModelPhoto[];
  onUpdated: (detail: ModelAssetDetail) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const featured = photos.filter((p) => p.featured);

  const call: Call = async (key, path, init) => {
    setBusy(key);
    setErr(null);
    try {
      onUpdated(await api<ModelAssetDetail>(path, { ...init, auth: token }));
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "更新に失敗しました");
      return false;
    } finally {
      setBusy(null);
    }
  };

  async function upload(kind: ModelPhoto["kind"], files: FileList | null, input: HTMLInputElement) {
    if (!files?.length) return;
    setBusy(`upload-${kind}`);
    const data = new FormData();
    data.append("kind", kind);
    for (const file of Array.from(files)) data.append("files[]", await shrinkPhoto(file));
    await call(`upload-${kind}`, `${base}/photos`, { method: "POST", body: data });
    input.value = "";
  }

  return (
    <section className="card space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">写真</h2>
          <p className="text-xs text-coffee-500">
            実物の写真と使っている様子の写真を複数枚登録できます (JPEG / PNG / WebP)。保存前にブラウザで縮小し、位置情報などは取り除きます。
            ★ を付けた写真 (最大 {MAX_FEATURED} 枚) を一覧とショップの商品ページでプレビュー表示します。
          </p>
        </div>
        <span className={`badge ${featured.length >= MAX_FEATURED ? "badge-accent" : "bg-coffee-100 text-coffee-600"}`}>
          プレビュー表示 {featured.length} / {MAX_FEATURED}
        </span>
      </div>

      {featured.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold text-coffee-500">プレビュー表示</div>
          <PhotoStrip photos={featured} alt={name} className="h-44 rounded-xl sm:h-56" />
        </div>
      )}

      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {KINDS.map((k) => {
        const list = photos.filter((p) => p.kind === k.key);
        return (
          <div key={k.key} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{k.label} <span className="font-normal text-coffee-400">{list.length} 枚</span></h3>
                <p className="text-[11px] text-coffee-400">{k.hint}</p>
              </div>
              <label className={`btn btn-outline !py-1 text-xs ${busy ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
                {busy === `upload-${k.key}` ? "アップロード中…" : `＋ ${k.label}を追加`}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy !== null} className="sr-only"
                       onChange={(e) => upload(k.key, e.target.files, e.currentTarget)} />
              </label>
            </div>
            {list.length === 0 ? (
              <p className="rounded-lg bg-coffee-50 p-3 text-center text-xs text-coffee-400">まだ写真がありません</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((p, i) => (
                  <PhotoCard key={p.id} photo={p} index={i} total={list.length} base={base} busy={busy !== null}
                             canFeature={p.featured || featured.length < MAX_FEATURED} call={call} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}

function PhotoCard({ photo: p, index, total, base, busy, canFeature, call }: {
  photo: ModelPhoto;
  index: number;
  total: number;
  base: string;
  busy: boolean;
  canFeature: boolean;
  call: Call;
}) {
  const path = `${base}/photos/${p.id}`;
  const patch = (body: Record<string, unknown>) => call(`photo-${p.id}`, path, { method: "PATCH", body: jsonBody(body) });
  const small = "rounded border border-coffee-200 bg-white px-1.5 py-0.5 disabled:opacity-40";

  return (
    <li className={`overflow-hidden rounded-xl border bg-white ${p.featured ? "border-caramel ring-1 ring-caramel/40" : "border-coffee-100"}`}>
      <div className="relative aspect-square bg-coffee-50">
        <a href={p.url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt={p.caption || `${p.kind_label} ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />
        </a>
        <button
          type="button"
          aria-pressed={p.featured}
          aria-label={p.featured ? "プレビュー表示をやめる" : "プレビューに表示する"}
          title={canFeature ? (p.featured ? "プレビュー表示をやめる" : "プレビューに表示する") : "プレビュー表示は3枚までです"}
          disabled={busy || !canFeature}
          onClick={() => patch({ featured: !p.featured })}
          className={`absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full text-base shadow-soft transition-colors disabled:opacity-50 ${
            p.featured ? "bg-caramel text-white" : "bg-white/90 text-coffee-400 hover:text-caramel"
          }`}
        >
          ★
        </button>
      </div>
      <div className="space-y-1.5 p-2">
        <input key={p.caption} defaultValue={p.caption} maxLength={200} placeholder="説明 (任意)" aria-label="写真の説明"
               onBlur={(e) => { if (e.target.value !== p.caption) patch({ caption: e.target.value }); }}
               className="input !py-1 text-xs" />
        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
          <div className="flex gap-1">
            <button type="button" disabled={busy || index === 0} onClick={() => patch({ position: index })}
                    aria-label="前へ" className={small}>←</button>
            <button type="button" disabled={busy || index === total - 1} onClick={() => patch({ position: index + 2 })}
                    aria-label="後ろへ" className={small}>→</button>
          </div>
          <select value={p.kind} disabled={busy} onChange={(e) => patch({ kind: e.target.value })} aria-label="写真の種類" className={small}>
            {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <button type="button" disabled={busy}
                  onClick={() => { if (window.confirm("この写真を削除しますか？")) call(`delete-${p.id}`, path, { method: "DELETE" }); }}
                  className="text-red-600 hover:underline disabled:opacity-40">削除</button>
        </div>
      </div>
    </li>
  );
}
