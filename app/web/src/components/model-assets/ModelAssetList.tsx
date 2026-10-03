"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { LoadError } from "@/components/LoadError";
import { PhotoStrip } from "@/components/PhotoStrip";
import { ModelSaleBadge, versionLabel } from "@/components/ModelSaleBadge";
import { CategorizedFileInputs, takeCategorizedFiles } from "@/components/model-assets/CategorizedFileInputs";
import type { ModelAssetDetail, ModelAssetSummary } from "@/lib/adminTypes";
import { fileCategoryLabel, MODEL_KINDS, type ModelKind } from "@/lib/modelKinds";

// 3Dモデル・DIY設計図の一覧 (制作権限): ファイルを版ごとに保存し、プレビュー・組み立て方法・販売をまとめて管理する
export function ModelAssetList({ kind }: { kind: ModelKind }) {
  const config = MODEL_KINDS[kind];
  const { token } = useAuth();
  const router = useRouter();
  const { data: models, error, mutate } = useSWR<ModelAssetSummary[]>(
    token ? ["model-assets", kind] : null,
    () => api<ModelAssetSummary[]>(`/admin/model_assets?kind=${kind}`, { auth: token })
  );
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = new FormData(e.currentTarget);
    body.set("kind", kind);
    if (!takeCategorizedFiles(body)) {
      setErr("ファイルを1つ以上選択してください");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const created = await api<ModelAssetDetail>("/admin/model_assets", { method: "POST", body, auth: token });
      await mutate();
      router.push(`${config.path}/${created.id}`);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "登録に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (error && !models) return <LoadError error={error} onRetry={() => mutate()} />;
  if (!models) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  const keyword = q.trim().toLowerCase();
  const shown = models.filter((m) => m.name.toLowerCase().includes(keyword));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{config.label}</h1>
          <p className="mt-1 text-sm text-coffee-500">{config.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前で絞り込み" aria-label="名前で絞り込み"
                 className="input !w-48" />
          <button type="button" onClick={() => setOpen((v) => !v)} className="btn btn-primary">
            {open ? "閉じる" : `＋ ${config.label}を登録`}
          </button>
        </div>
      </div>

      {open && (
        <form onSubmit={create} className="card grid gap-3 p-5 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">名前 *</span>
            <input name="name" required className="input" />
          </label>
          <label className="block">
            <span className="field-label">版のメモ</span>
            <input name="note" placeholder="初版" className="input" />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="field-label">ファイル * (どれか1つ以上。複数選択可。{config.formats}、合計 100MB まで)</legend>
            <CategorizedFileInputs accept={config.accept} />
          </fieldset>
          <label className="block sm:col-span-2">
            <span className="field-label">説明</span>
            <textarea name="description" rows={2} className="input" />
          </label>
          <label className="block sm:col-span-2">
            <span className="field-label">利用許諾</span>
            <input name="license" placeholder="例: 個人利用のみ・再配布不可" className="input" />
          </label>
          {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{err}</p>}
          <div className="sm:col-span-2">
            <button disabled={busy} className="btn btn-primary">{busy ? "アップロード中…" : "登録する"}</button>
          </div>
        </form>
      )}

      {shown.length === 0 ? (
        <div className="card p-10 text-center text-sm text-coffee-500">
          {models.length === 0
            ? `まだ${config.label}がありません。「${config.label}を登録」から追加してください。`
            : `該当する${config.label}はありません`}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => (
            <li key={m.id}>
              <Link href={`${config.path}/${m.id}`} className="card card-interactive block overflow-hidden">
                <div className="aspect-[4/3] bg-coffee-50">
                  {m.preview_photos.length > 0 ? (
                    <PhotoStrip photos={m.preview_photos} alt={m.name} className="h-full" />
                  ) : m.preview_image_url ? (
                    <img src={m.preview_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-coffee-300">
                      {kind === "blueprint" ? <BlueprintIcon /> : <CubeIcon />}
                      <span className="text-xs">プレビュー画像なし</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{m.name}</span>
                    <ModelSaleBadge model={m} />
                  </div>
                  <div className="text-xs text-coffee-500">
                    {m.current_version ? versionLabel(m.current_version) : "ファイルなし"}
                    {` · 手順 ${m.assembly_steps_count} · 更新 ${fmtDate(m.updated_at)}`}
                  </div>
                  {m.current_version && m.current_version.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.current_version.categories.map((c) => (
                        <span key={c} className="badge badge-muted">{fileCategoryLabel(c)}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden className="h-10 w-10">
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </svg>
  );
}

function BlueprintIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden className="h-10 w-10">
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M7 16V9h6v7M13 12h4M7 20v-4M17 16v-4" />
    </svg>
  );
}
