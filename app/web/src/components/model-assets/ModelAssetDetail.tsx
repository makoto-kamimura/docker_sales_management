"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, apiOriginUrl, downloadAuthedFile, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fileSize, fmtDate } from "@/lib/format";
import { AssemblyImport } from "@/components/AssemblyImport";
import { BlueprintViewer, blueprintCapturable, type BlueprintViewerHandle } from "@/components/BlueprintViewer";
import { LoadError } from "@/components/LoadError";
import { Markdown } from "@/components/Markdown";
import { MarkdownField } from "@/components/MarkdownField";
import { ModelPhotos } from "@/components/ModelPhotos";
import { ModelViewer, type ModelViewerHandle } from "@/components/ModelViewer";
import { MODEL_GRID_MAX, ModelViewerGrid } from "@/components/ModelViewerGrid";
import { ModelSaleBadge, versionLabel } from "@/components/ModelSaleBadge";
import { CategorizedFileInputs, takeCategorizedFiles } from "@/components/model-assets/CategorizedFileInputs";
import type { AssemblyStep, ModelAssetDetail, ModelFile, ModelFileCategory, ModelVersion } from "@/lib/adminTypes";
import { FILE_CATEGORIES, MODEL_KINDS, type ModelKind } from "@/lib/modelKinds";

const IMAGE_ACCEPT = "image/png,image/jpeg";

/** three.js で3D表示する形式 (3Dモデルのファイルと、DIY設計図に添える完成品の3Dデータ)。ModelViewer の対応形式と揃える */
const MODEL_3D_FORMATS = ["STL", "OBJ", "3MF"];
const is3d = (format: string) => MODEL_3D_FORMATS.includes(format.toUpperCase());

type Send = (path: string, method: string, body?: FormData | object) => Promise<ModelAssetDetail>;
type Run = (key: string, call: () => Promise<ModelAssetDetail | void>) => Promise<boolean>;

/** 空のファイル欄は送らない (画像を変えない) */
function withoutEmptyFile(form: HTMLFormElement, name: string) {
  const data = new FormData(form);
  const file = data.get(name);
  if (!(file instanceof File) || file.size === 0) data.delete(name);
  return data;
}

// 3Dモデル・DIY設計図の詳細 (制作権限): プレビュー・基本情報・販売フラグ・版管理 (複数ファイル)・組み立て方法 / PDF。
// kind は開いた画面の種別。データの種別と違う場合は正しい画面へ移る
export function ModelAssetDetailPage({ id, kind }: { id: string; kind: ModelKind }) {
  const config = MODEL_KINDS[kind];
  const { token } = useAuth();
  const router = useRouter();
  const base = `/admin/model_assets/${id}`;
  const { data: m, error, mutate } = useSWR<ModelAssetDetail>(
    token ? ["model-asset", id] : null,
    () => api<ModelAssetDetail>(base, { auth: token })
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // 実行中の操作
  const [preview, setPreview] = useState<{ versionId: number; fileId?: number } | null>(null); // null: 最新版
  const [category, setCategory] = useState<ModelFileCategory | null>(null); // 表示するカテゴリ (null: 自動)
  const [showAllSetting, setShowAll] = useState<boolean | null>(null); // カテゴリの3Dファイルを並べて表示 (null: 自動)
  const [uploadMode, setUploadMode] = useState<"new" | "append">("new"); // 新しい版 / 最新版にファイルを追加
  const [editingVersion, setEditingVersion] = useState<number | null>(null); // カテゴリを変更中の版
  const [addStepKey, setAddStepKey] = useState(0); // 追加後にフォーム (Markdown 入力) を空に戻す
  const viewer = useRef<ModelViewerHandle>(null);
  const blueprintViewer = useRef<BlueprintViewerHandle>(null);
  const viewerSection = useRef<HTMLElement>(null);
  const isBlueprint = kind === "blueprint";

  // 設計図を3Dモデルの画面で開いた (またはその逆) ときは、その種別の画面へ
  const actualKind = m?.kind;
  useEffect(() => {
    if (actualKind && actualKind !== kind) router.replace(`${MODEL_KINDS[actualKind].path}/${id}`);
  }, [actualKind, kind, id, router]);

  const currentVersion = m?.versions.find((v) => v.current) ?? null;
  const previewVersion = m?.versions.find((v) => v.id === preview?.versionId) ?? currentVersion;
  // カテゴリ (オールインワン / 分割) のファイルがある版はカテゴリのタブで切り替える。
  // 最初はオールインワン → 分割 → その他 の順で、ファイルのあるカテゴリを表示する
  const versionCategories = categoriesOf(previewVersion);
  const activeCategory = versionCategories
    ? (versionCategories.find((c) => c.key === category) ?? versionCategories[0]).key
    : null;
  const categoryFiles = previewVersion?.files.filter((f) => !activeCategory || f.category === activeCategory) ?? [];
  // 最初は3Dのファイルを表示する (設計図に完成品の3Dデータがあれば、図面より先に全体像を見せる)
  const previewFile =
    categoryFiles.find((f) => f.id === preview?.fileId) ??
    categoryFiles.find((f) => f.previewable && is3d(f.format)) ??
    categoryFiles.find((f) => f.previewable) ??
    categoryFiles[0] ??
    null;
  // 期限付き URL (10分)。フォーカスのたびに取り直すとモデルを再読み込みしてしまうので自動更新しない
  const { data: fileUrl, error: fileError } = useSWR<{ url: string }>(
    token && previewVersion && previewFile?.previewable ? ["model-file", previewVersion.id, previewFile.id] : null,
    () => api<{ url: string }>(`${base}/versions/${previewVersion?.id}/file?file_id=${previewFile?.id}&disposition=inline`, { auth: token }),
    { revalidateOnFocus: false, revalidateIfStale: false, revalidateOnReconnect: false }
  );
  // 表示中のファイルが3Dなら three.js、それ以外 (設計図の図面) は BlueprintViewer で表示する
  const show3d = !!previewFile?.previewable && is3d(previewFile.format);
  // 全データプレビューは表示中のカテゴリの3Dのファイルだけを並べる。分割のカテゴリは最初から並べる
  const previewable3dFiles = categoryFiles.filter((f) => f.previewable && is3d(f.format));
  const gridFiles = previewable3dFiles.slice(0, MODEL_GRID_MAX);
  const showAll = showAllSetting ?? activeCategory === "parts";
  const gridMode = showAll && gridFiles.length > 1;
  // 全データプレビュー用: 各ファイルの期限付き URL をまとめて発行する
  const { data: gridUrls, error: gridError } = useSWR<string[]>(
    token && previewVersion && gridMode ? ["model-files", previewVersion.id, ...gridFiles.map((f) => f.id)] : null,
    () => Promise.all(gridFiles.map((f) =>
      api<{ url: string }>(`${base}/versions/${previewVersion?.id}/file?file_id=${f.id}&disposition=inline`, { auth: token })
        .then(({ url }) => apiOriginUrl(url))
    )),
    { revalidateOnFocus: false, revalidateIfStale: false, revalidateOnReconnect: false }
  );

  const send: Send = (path, method, body) =>
    api<ModelAssetDetail>(path, {
      method,
      auth: token,
      body: body instanceof FormData ? body : body === undefined ? undefined : jsonBody(body),
    });

  /** 更新 API を呼び、返ってきた最新の詳細で画面を置き換える */
  const run: Run = async (key, call) => {
    setErr(null);
    setBusy(key);
    try {
      const updated = await call();
      if (updated) await mutate(updated, { revalidate: false });
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラーが発生しました");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const canCapture = !!previewFile?.previewable && (show3d || blueprintCapturable(previewFile.format));

  async function savePreview() {
    const blob = await (gridMode || show3d ? viewer.current : blueprintViewer.current)?.capture();
    if (!blob) {
      setErr(`${gridMode || show3d ? "3Dモデル" : "図面"}の表示が終わってから保存してください`);
      return;
    }
    const data = new FormData();
    data.append("image", blob, "preview.png");
    await run("preview", () => send(`${base}/preview`, "POST", data));
  }

  function showPreview(v: ModelVersion, f: ModelFile) {
    setPreview({ versionId: v.id, fileId: f.id });
    setCategory(f.category);
    setShowAll(false);
    viewerSection.current?.scrollIntoView({ behavior: "smooth" });
  }

  function selectCategory(key: ModelFileCategory) {
    if (previewVersion) setPreview({ versionId: previewVersion.id });
    setCategory(key);
    setShowAll(null);
  }

  /** 版を登録・変更した後は最新版を自動の表示に戻す */
  function resetPreview() {
    setPreview(null);
    setCategory(null);
    setShowAll(null);
  }

  /** 期限付き URL を発行してダウンロードする (ファイル単体 / まとめて ZIP) */
  async function openSigned(path: string) {
    setErr(null);
    try {
      const { url } = await api<{ url: string }>(path, { auth: token });
      window.location.assign(apiOriginUrl(url));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ダウンロードに失敗しました");
    }
  }

  async function exportPdf(name: string) {
    await run("pdf", () => downloadAuthedFile(`${base}/assembly_pdf`, token, `${name}_組み立て説明書.pdf`));
  }

  if (!token) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;
  if (error && !m) return <LoadError error={error} onRetry={() => mutate()} />;
  if (!m || m.kind !== kind) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={config.path} className="text-sm text-coffee-500 hover:text-caramel">← {config.label}一覧</Link>
          <h1 className="mt-1 text-2xl font-bold">{m.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-coffee-500">
            {m.current_version && <span className="badge badge-accent">{versionLabel(m.current_version)}</span>}
            <ModelSaleBadge model={m} />
            <span>更新 {fmtDate(m.updated_at)}{m.created_by && ` · 登録 ${m.created_by.name}`}</span>
          </div>
        </div>
        <button type="button" disabled={busy === "pdf"} onClick={() => exportPdf(m.name)} className="btn btn-outline">
          {busy === "pdf" ? "PDF を作成中…" : "📄 組み立て説明書 (PDF)"}
        </button>
      </div>

      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* プレビュー (3Dのファイル: three.js / 設計図の図面: PDF・画像・DXF) */}
        <section ref={viewerSection} className="card space-y-3 p-4 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              {config.previewTitle}
              {previewVersion && <span className="ml-2 text-sm font-normal text-coffee-500">v{previewVersion.label}</span>}
            </h2>
            {previewFile?.previewable && !show3d && blueprintCapturable(previewFile.format) && (
              <button type="button" onClick={() => blueprintViewer.current?.resetView()} className="btn btn-outline !px-3 !py-1 text-xs">
                全体を表示
              </button>
            )}
            {show3d && (
              <div className="flex flex-wrap gap-1.5 text-xs">
                <button type="button" onClick={() => viewer.current?.rotate()} className="btn btn-outline !px-3 !py-1">向きを変える</button>
                {previewable3dFiles.length > 1 && (
                  <button type="button" onClick={() => setShowAll(!gridMode)} aria-pressed={gridMode}
                          className={`btn !px-3 !py-1 ${gridMode ? "btn-primary" : "btn-outline"}`}>
                    {gridMode ? "1つずつ表示" : `${activeCategory === "parts" ? "全パーツを並べる" : "全データプレビュー"} (${previewable3dFiles.length})`}
                  </button>
                )}
                <button type="button" onClick={() => viewer.current?.resetView()} className="btn btn-outline !px-3 !py-1">視点を戻す</button>
              </div>
            )}
          </div>
          {previewVersion && versionCategories && (
            <div role="tablist" aria-label="ファイルのカテゴリ" className="flex flex-wrap gap-1.5">
              {versionCategories.map((c) => (
                <button key={c.key} type="button" role="tab" aria-selected={c.key === activeCategory}
                        onClick={() => selectCategory(c.key)}
                        className={`btn !px-3 !py-1 text-xs ${c.key === activeCategory ? "btn-primary" : "btn-outline"}`}>
                  {c.label} ({previewVersion.files.filter((f) => f.category === c.key).length})
                </button>
              ))}
            </div>
          )}
          {gridMode && previewable3dFiles.length > MODEL_GRID_MAX && (
            <p className="text-xs text-coffee-500">
              3Dでプレビューできるファイルが {previewable3dFiles.length} 件あります。先頭の {MODEL_GRID_MAX} 件を表示しています。
            </p>
          )}
          {previewVersion && categoryFiles.length > 1 && !gridMode && (
            <select
              value={previewFile?.id ?? ""}
              onChange={(e) => setPreview({ versionId: previewVersion.id, fileId: Number(e.target.value) })}
              aria-label="プレビューするファイル"
              className="input !py-1.5 text-sm"
            >
              {categoryFiles.map((f) => (
                <option key={f.id} value={f.id} disabled={!f.previewable}>
                  {f.filename}{f.previewable ? "" : " (プレビュー不可)"}
                </option>
              ))}
            </select>
          )}
          {previewVersion && gridMode ? (
            gridError ? (
              <p role="alert" className="grid aspect-[4/3] place-items-center rounded-xl bg-coffee-50 p-6 text-sm text-red-700">{gridError.message}</p>
            ) : (
              <ModelViewerGrid
                key={`${previewVersion.id}-${activeCategory ?? "all"}-grid`}
                ref={viewer}
                items={gridFiles.map((f, i) => ({ key: f.id, url: gridUrls?.[i] ?? null, format: f.format, label: f.filename }))}
                onSelect={(i) => showPreview(previewVersion, gridFiles[i])}
                className="aspect-[4/3] w-full"
              />
            )
          ) : previewVersion && previewFile?.previewable ? (
            fileError ? (
              <p role="alert" className="grid aspect-[4/3] place-items-center rounded-xl bg-coffee-50 p-6 text-sm text-red-700">{fileError.message}</p>
            ) : !show3d ? (
              <BlueprintViewer
                key={`${previewVersion.id}-${previewFile.id}`}
                ref={blueprintViewer}
                url={fileUrl ? apiOriginUrl(fileUrl.url) : null}
                format={previewFile.format}
                className="aspect-[4/3] w-full"
              />
            ) : (
              <ModelViewer
                key={`${previewVersion.id}-${previewFile.id}`}
                ref={viewer}
                url={fileUrl ? apiOriginUrl(fileUrl.url) : null}
                format={previewFile.format}
                className="aspect-[4/3] w-full"
              />
            )
          ) : (
            <div className="grid aspect-[4/3] place-items-center rounded-xl bg-coffee-50 p-6 text-center text-sm text-coffee-500">
              {previewFile
                ? `${previewFile.format} はブラウザでプレビューできません (${config.previewableFormats} に対応)。版の一覧からダウンロードして確認してください。`
                : "ファイルがありません"}
            </div>
          )}
          <p className="text-xs text-coffee-400">
            {show3d || gridMode || (!isBlueprint && !previewFile?.previewable)
              ? "ドラッグで回転、ホイール・ピンチで拡大、右ドラッグ (2本指) で移動できます。"
              : "画像・DXF はホイール・ピンチで拡大、ドラッグで移動できます。PDF はブラウザのビューアで操作してください。"}
          </p>
          <div className="flex flex-wrap items-center gap-3 border-t border-coffee-100 pt-3">
            {m.preview_image_url ? (
              <img src={m.preview_image_url} alt="保存済みのプレビュー画像" className="h-16 w-20 rounded-lg border border-coffee-100 object-cover" />
            ) : (
              <div className="grid h-16 w-20 place-items-center rounded-lg border border-dashed border-coffee-200 text-[10px] text-coffee-400">未保存</div>
            )}
            <p className="min-w-0 flex-1 text-xs text-coffee-500">
              いまの表示をプレビュー画像として保存します。一覧・組み立て説明書の表紙・ショップの商品画像に使われます。
              {isBlueprint && previewFile?.previewable && !canCapture && " PDF の表示は保存できないので、画像・DXF・3Dデータを表示するか、写真を登録して★を付けてください。"}
            </p>
            <button type="button" disabled={!canCapture || busy === "preview"} onClick={savePreview}
                    className="btn btn-primary !py-1.5 text-sm">
              {busy === "preview" ? "保存中…" : "この表示を画像に保存"}
            </button>
          </div>
        </section>

        <div className="space-y-6 lg:col-span-2">
          {/* 基本情報 */}
          <section className="card space-y-3 p-5">
            <h2 className="font-semibold">基本情報</h2>
            <form
              key={`${m.name}|${m.description}|${m.license}`}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run("info", () => send(base, "PATCH", { name: f.get("name"), description: f.get("description"), license: f.get("license") }));
              }}
              className="space-y-3"
            >
              <Field label="名前"><input name="name" required defaultValue={m.name} className="input" /></Field>
              <Field label="説明"><textarea name="description" rows={3} defaultValue={m.description} className="input" /></Field>
              <Field label="利用許諾 (販売時に表示)">
                <input name="license" defaultValue={m.license} placeholder="例: 個人利用のみ・再配布不可" className="input" />
              </Field>
              <button disabled={busy === "info"} className="btn btn-primary">保存</button>
            </form>
          </section>

          {/* 販売フラグ */}
          <section className="card space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">販売</h2>
              <ModelSaleBadge model={m} />
            </div>
            <p className="text-xs text-coffee-500">
              オンにするとショップの「{config.shopCategory}」に公開し、最新版のファイルを購入者に配布します (複数ファイルの版は ZIP にまとめます)。
              版を追加すると配布ファイルも差し替わります。オフにしても購入済みの人は引き続きダウンロードできます。
              価格を 0円にすると無料配布になり、購入者は注文詳細から投げ銭で応援できます。
            </p>
            <form
              key={`${m.for_sale}|${m.price_cents}`}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run("sale", () => send(base, "PATCH", { for_sale: f.get("for_sale") === "on", price_cents: Number(f.get("price_cents")) }));
              }}
              className="space-y-3"
            >
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="for_sale" defaultChecked={m.for_sale} className="h-4 w-4 accent-caramel" />
                販売する
              </label>
              <Field label="価格 (税抜・円。0円で無料配布)">
                <input type="number" name="price_cents" min={0} step={1} defaultValue={m.price_cents} className="input" />
              </Field>
              <button disabled={busy === "sale"} className="btn btn-primary">販売設定を保存</button>
            </form>
            {m.product && (
              <p className="text-xs text-coffee-500">
                商品 {m.product.sku}
                {m.product.published ? (
                  <> · <Link href={`/products/${m.product.id}`} className="text-caramel hover:underline">ショップで見る →</Link></>
                ) : " · 非公開"}
              </p>
            )}
          </section>
        </div>
      </div>

      {/* 写真 (実モデル画像 / 実利用画像) */}
      <ModelPhotos base={base} token={token} name={m.name} photos={m.photos}
                   onUpdated={(detail) => { setErr(null); mutate(detail, { revalidate: false }); }} />

      {/* 版管理 */}
      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">版管理</h2>
          <p className="text-xs text-coffee-500">
            ファイルを登録すると最新版になります。複数のファイル ({config.filesExample}) をまとめて1つの版にできます (20個・合計 100MB まで)。
            過去の版もファイルごと残ります。「ファイルを追加」は最新版のファイルを引き継いで、選んだファイルを足した版 (v3 → v3.1) を作ります。
            ファイルは「オールインワン」「分割」「その他」に分けて登録でき、プレビューをカテゴリで切り替えられます。
            カテゴリはあとから「カテゴリを変更」で変えられます (ファイルは変わりません)。
          </p>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const data = new FormData(form);
            data.delete("mode");
            if (!takeCategorizedFiles(data)) {
              setErr("ファイルを1つ以上選択してください");
              return;
            }
            const append = uploadMode === "append" && !!currentVersion;
            if (append) data.set("append", "true");
            if (await run("version", () => send(`${base}/versions`, "POST", data))) {
              form.reset();
              setUploadMode("new");
              resetPreview();
            }
          }}
          className="space-y-3 rounded-xl border border-dashed border-coffee-200 p-4"
        >
          {currentVersion ? (
            <div role="radiogroup" aria-label="登録のしかた" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" name="mode" value="new" checked={uploadMode === "new"} onChange={() => setUploadMode("new")}
                       className="accent-caramel" />
                新しい版を登録 (v{currentVersion.number + 1})
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="mode" value="append" checked={uploadMode === "append"} onChange={() => setUploadMode("append")}
                       className="accent-caramel" />
                v{currentVersion.label} にファイルを追加 (→ v{currentVersion.number}.{currentVersion.minor + 1})
              </label>
            </div>
          ) : (
            <div className="text-sm font-semibold">新しい版を登録</div>
          )}
          <CategorizedFileInputs accept={config.accept} />
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <input name="note" aria-label={uploadMode === "append" ? "追加内容" : "変更内容"}
                   placeholder={uploadMode === "append" ? "追加内容 (例: 完成品の3Dデータ)" : config.notePlaceholder}
                   className="input !w-72" />
            <button disabled={busy === "version"} className="btn btn-primary">
              {busy === "version" ? "アップロード中…" : uploadMode === "append" && currentVersion ? "ファイルを追加" : "新しい版を登録"}
            </button>
          </div>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="bg-coffee-50 text-xs uppercase tracking-wide text-coffee-500">
              <tr>
                <th className="p-3 text-left font-semibold">版</th>
                <th className="p-3 text-left font-semibold">変更内容</th>
                <th className="p-3 text-left font-semibold">ファイル</th>
                <th className="p-3 text-left font-semibold">登録</th>
                <th className="p-3 text-right font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {m.versions.map((v) => (
                <tr key={v.id} className={`border-t border-coffee-100 align-top ${previewVersion?.id === v.id ? "bg-caramel/5" : ""}`}>
                  <td className="whitespace-nowrap p-3 font-semibold">
                    v{v.label}
                    {v.current && <span className="badge badge-accent ml-1.5">最新</span>}
                  </td>
                  <td className="p-3 text-coffee-700">{v.note || "—"}</td>
                  <td className="p-3">
                    {editingVersion === v.id ? (
                      <CategoryEditor
                        version={v}
                        busy={busy === `categories-${v.id}`}
                        onCancel={() => setEditingVersion(null)}
                        onSave={async (categories) => {
                          if (await run(`categories-${v.id}`, () => send(`${base}/versions/${v.id}`, "PATCH", { categories }))) {
                            setEditingVersion(null);
                          }
                        }}
                      />
                    ) : (
                      // カテゴリのある版はカテゴリごとに見出しを付けて並べる
                      (categoriesOf(v) ?? [null]).map((c) => {
                        const files = c ? v.files.filter((f) => f.category === c.key) : v.files;
                        return (
                          <div key={c?.key ?? "all"} className={c ? "mt-2 first:mt-0" : ""}>
                            {c && <div className="mb-0.5 text-[11px] font-semibold text-coffee-500">{c.label} ({files.length})</div>}
                            <ul className="space-y-1">
                              {files.map((f) => (
                                <li key={f.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                                  <span className={`max-w-[15rem] truncate ${previewFile?.id === f.id && previewVersion?.id === v.id ? "font-semibold text-caramel" : "text-coffee-700"}`}
                                        title={f.filename}>{f.filename}</span>
                                  <span className="text-coffee-400">{f.format} · {fileSize(f.byte_size)}</span>
                                  {f.previewable && (
                                    <button type="button" onClick={() => showPreview(v, f)} className="text-caramel hover:underline">プレビュー</button>
                                  )}
                                  <button type="button" onClick={() => openSigned(`${base}/versions/${v.id}/file?file_id=${f.id}`)}
                                          className="text-caramel hover:underline">ダウンロード</button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })
                    )}
                    {v.files.length > 1 && (
                      <div className="mt-1 text-[11px] text-coffee-400">{v.files.length} ファイル · 合計 {fileSize(v.byte_size)}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3 text-xs text-coffee-500">
                    {fmtDate(v.created_at)}
                    <div>{v.created_by?.name ?? "—"}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-1.5 text-xs">
                      {v.files.length > 1 && (
                        <button type="button" onClick={() => openSigned(`${base}/versions/${v.id}/bundle`)}
                                className="btn btn-outline !px-2.5 !py-1">まとめてダウンロード (ZIP)</button>
                      )}
                      {editingVersion !== v.id && (
                        <button type="button" onClick={() => setEditingVersion(v.id)} className="btn btn-outline !px-2.5 !py-1">
                          カテゴリを変更
                        </button>
                      )}
                      {!v.current && (
                        <button
                          type="button"
                          disabled={busy === `restore-${v.id}`}
                          onClick={async () => {
                            if (!window.confirm(`v${v.label} のファイルで新しい版を作ります。よろしいですか？`)) return;
                            if (await run(`restore-${v.id}`, () => send(`${base}/versions/${v.id}/restore`, "POST"))) resetPreview();
                          }}
                          className="btn btn-outline !px-2.5 !py-1"
                        >
                          この版に戻す
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 組み立て方法 */}
      <section className="card space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">組み立て方法</h2>
            <p className="text-xs text-coffee-500">
              部品・工具と手順の説明は Markdown で書けます (入力しながらプレビューを確認できます)。手順は組み立て説明書 (PDF) に出力されます。
              販売中の{config.label}を購入した人も、注文詳細・アカウント画面からダウンロードできます。画像は PNG / JPEG (5MB まで)。
            </p>
          </div>
          <button type="button" disabled={busy === "pdf"} onClick={() => exportPdf(m.name)} className="btn btn-outline">📄 PDFを出力</button>
        </div>

        <AssemblyImport base={base} token={token} currentStepCount={m.assembly_steps.length}
                        onImported={(detail) => { setErr(null); mutate(detail, { revalidate: false }); }} />

        <form
          key={m.assembly_notes}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run("notes", () => send(base, "PATCH", { assembly_notes: f.get("assembly_notes") }));
          }}
          className="space-y-2"
        >
          <MarkdownField name="assembly_notes" label="必要な部品・工具" defaultValue={m.assembly_notes} rows={4}
                         placeholder={"- M3×10 ネジ 4本\n- 六角レンチ (2.5mm)"} />
          <button disabled={busy === "notes"} className="btn btn-outline !py-1.5 text-sm">保存</button>
        </form>

        {m.assembly_steps.length === 0 ? (
          <p className="rounded-lg bg-coffee-50 p-4 text-center text-sm text-coffee-500">まだ手順がありません。下のフォームから追加してください。</p>
        ) : (
          <ol className="space-y-3">
            {m.assembly_steps.map((s, i) => (
              <StepItem key={s.id} step={s} index={i} total={m.assembly_steps.length} path={`${base}/assembly_steps/${s.id}`}
                        busy={busy} run={run} send={send} />
            ))}
          </ol>
        )}

        <form
          key={addStepKey}
          onSubmit={async (e) => {
            e.preventDefault();
            const data = withoutEmptyFile(e.currentTarget, "image");
            if (await run("add-step", () => send(`${base}/assembly_steps`, "POST", data))) setAddStepKey((k) => k + 1);
          }}
          className="space-y-3 rounded-xl border border-dashed border-coffee-200 p-4"
        >
          <div className="text-sm font-semibold">STEP {m.assembly_steps.length + 1} を追加</div>
          <Field label="見出し"><input name="title" placeholder="例: 土台に軸を差し込む" className="input" /></Field>
          <MarkdownField name="body" label="説明" rows={6}
                         placeholder={"シャフトを**奥まで**差し込みます。\n\n1. 穴の向きを確認する\n2. 軽くたたいて固定する"} />
          <Field label="画像 (任意)"><input type="file" name="image" accept={IMAGE_ACCEPT} className="input text-xs" /></Field>
          <button disabled={busy === "add-step"} className="btn btn-primary">
            {busy === "add-step" ? "保存中…" : "手順を追加"}
          </button>
        </form>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy === "delete"}
          onClick={async () => {
            if (!window.confirm(`「${m.name}」を削除しますか？\nすべての版と組み立て手順が削除されます。販売中の商品は非公開になります (購入済みの人は引き続きダウンロードできます)。`)) return;
            if (await run("delete", async () => { await api(base, { method: "DELETE", auth: token }); })) router.push(config.path);
          }}
          className="text-sm text-red-600 hover:underline"
        >
          この{config.label}を削除
        </button>
      </div>
    </div>
  );
}

/** 版のファイルのカテゴリを変える (ファイル自体は変えない) */
function CategoryEditor({ version, busy, onSave, onCancel }: {
  version: ModelVersion;
  busy: boolean;
  onSave: (categories: Record<number, ModelFileCategory>) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        onSave(Object.fromEntries(version.files.map((f) => [f.id, data.get(`category-${f.id}`) as ModelFileCategory])));
      }}
      className="space-y-2"
    >
      <ul className="space-y-1">
        {version.files.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-2 text-xs">
            <select name={`category-${f.id}`} defaultValue={f.category} aria-label={`${f.filename} のカテゴリ`}
                    className="input !w-auto !py-1 text-xs">
              {FILE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <span className="max-w-[15rem] truncate text-coffee-700" title={f.filename}>{f.filename}</span>
            <span className="text-coffee-400">{f.format}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-1.5 text-xs">
        <button disabled={busy} className="btn btn-primary !px-2.5 !py-1">{busy ? "保存中…" : "カテゴリを保存"}</button>
        <button type="button" onClick={onCancel} className="btn btn-outline !px-2.5 !py-1">キャンセル</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function StepItem({ step, index, total, path, busy, run, send }: {
  step: AssemblyStep;
  index: number;
  total: number;
  path: string;
  busy: string | null;
  run: Run;
  send: Send;
}) {
  const [editing, setEditing] = useState(false);
  // position は 1 始まり。いまの位置は index + 1
  const move = (position: number) => run(`move-${step.id}`, () => send(path, "PATCH", { position }));

  if (editing) {
    return (
      <li className="rounded-xl border border-caramel/40 p-4">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const data = withoutEmptyFile(e.currentTarget, "image");
            if (await run(`edit-${step.id}`, () => send(path, "PATCH", data))) setEditing(false);
          }}
          className="space-y-3"
        >
          <div className="text-xs font-bold tracking-[0.15em] text-caramel">STEP {index + 1}</div>
          <Field label="見出し"><input name="title" defaultValue={step.title} className="input" /></Field>
          <MarkdownField name="body" label="説明" rows={6} defaultValue={step.body} />
          <Field label={step.image_url ? "画像を差し替える" : "画像を追加"}>
            <input type="file" name="image" accept={IMAGE_ACCEPT} className="input text-xs" />
          </Field>
          {step.image_url && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="remove_image" value="true" className="h-4 w-4 accent-caramel" /> 画像を外す
            </label>
          )}
          <div className="flex gap-2">
            <button disabled={busy === `edit-${step.id}`} className="btn btn-primary !py-1.5 text-sm">保存</button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-outline !py-1.5 text-sm">キャンセル</button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-coffee-100 p-4 sm:flex-row">
      {step.image_url && (
        <img src={step.image_url} alt={`STEP ${index + 1} の画像`} className="h-28 w-full rounded-lg border border-coffee-100 object-cover sm:w-40" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold tracking-[0.15em] text-caramel">STEP {index + 1}</div>
        {step.title && <div className="mt-0.5 font-semibold">{step.title}</div>}
        {step.body && <Markdown className="mt-1">{step.body}</Markdown>}
      </div>
      <div className="flex shrink-0 flex-wrap items-start gap-1.5 text-xs sm:flex-col sm:items-end">
        <div className="flex gap-1">
          <button type="button" disabled={index === 0 || busy !== null} onClick={() => move(index)}
                  aria-label={`STEP ${index + 1} を上へ`} className="btn btn-outline !px-2 !py-1">↑</button>
          <button type="button" disabled={index === total - 1 || busy !== null} onClick={() => move(index + 2)}
                  aria-label={`STEP ${index + 1} を下へ`} className="btn btn-outline !px-2 !py-1">↓</button>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="btn btn-outline !px-2.5 !py-1">編集</button>
        <button
          type="button"
          disabled={busy === `delete-${step.id}`}
          onClick={() => { if (window.confirm(`STEP ${index + 1} を削除しますか？`)) run(`delete-${step.id}`, () => send(path, "DELETE")); }}
          className="btn btn-outline !px-2.5 !py-1 text-red-600"
        >
          削除
        </button>
      </div>
    </li>
  );
}

/** 版にあるカテゴリ (表示順)。オールインワン・分割のファイルがない (未分類だけの) 版は null */
function categoriesOf(v: ModelVersion | null | undefined) {
  if (!v || !v.files.some((f) => f.category !== "other")) return null;
  return FILE_CATEGORIES.filter((c) => v.files.some((f) => f.category === c.key));
}
