"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { Markdown } from "./Markdown";
import type { ModelAssetDetail } from "@/lib/adminTypes";

type ImportPreview = {
  /** null: ファイルに部品・工具の見出しがない (いまの内容のまま) */
  assembly_notes: string | null;
  steps: { title: string; body: string }[];
  warnings: string[];
};

const EXAMPLE = `# ギアボックス

## 必要な部品・工具
- M3×10 ネジ 4本
- 六角レンチ (2.5mm)

## 組み立て手順

### 土台に軸を差し込む
ベースプレートの穴にシャフトを**奥まで**差し込みます。

### ギアをはめる
1. 小ギアを通す
2. 大ギアを通す

> 歯がかみ合っていることを確認します`;

/** Markdown ファイル1つから「必要な部品・工具」と組み立て手順を取り込む (内容を確認してから登録する) */
export function AssemblyImport({ base, token, currentStepCount, onImported }: {
  base: string;
  token: string | null;
  currentStepCount: number;
  onImported: (detail: ModelAssetDetail) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    if (input.current) input.current.value = "";
  }

  async function load(selected: File | null) {
    setErr(null);
    setPreview(null);
    setFile(selected);
    if (!selected) return;
    setMode(currentStepCount > 0 ? "append" : "replace");
    setBusy(true);
    try {
      const data = new FormData();
      data.append("file", selected);
      data.append("dry_run", "true");
      setPreview(await api<ImportPreview>(`${base}/assembly_import`, { method: "POST", body: data, auth: token }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!file) return;
    if (mode === "replace" && currentStepCount > 0 &&
        !window.confirm(`いまの手順 ${currentStepCount} 件を削除して、ファイルの内容に置き換えます。よろしいですか？`)) return;
    setErr(null);
    setBusy(true);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("mode", mode);
      onImported(await api<ModelAssetDetail>(`${base}/assembly_import`, { method: "POST", body: data, auth: token }));
      reset();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "取り込みに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  const offset = mode === "append" ? currentStepCount : 0;

  return (
    <div className="space-y-3 rounded-xl border border-coffee-200 bg-coffee-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Markdown ファイルから取り込む</div>
          <p className="text-xs text-coffee-500">
            1つの .md ファイルから「必要な部品・工具」と手順をまとめて登録します。登録する前に内容を確認できます。
          </p>
        </div>
        <input ref={input} type="file" accept=".md,.markdown,text/markdown,text/plain" aria-label="取り込む Markdown ファイル"
               onChange={(e) => load(e.target.files?.[0] ?? null)} className="input !w-64 text-xs" />
      </div>

      <details className="text-xs text-coffee-600">
        <summary className="cursor-pointer text-caramel">ファイルの書き方</summary>
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          <li>「部品」「工具」「材料」などを含む見出しの下 → 必要な部品・工具</li>
          <li>「手順」「組み立て」などを含む見出しの下の小見出し → 1つずつ手順 (小見出しが手順の見出し、その下の文章が説明)</li>
          <li>手順の見出しの下に小見出しがなければ、番号付きリストの項目を1つずつ手順にします</li>
          <li>「手順」の見出しがなければ、ほかの見出しをそれぞれ手順にします (1つだけの # 見出しはタイトルとして使いません)</li>
          <li>「STEP 1」「1.」などの番号は自動で外します。画像は取り込まれないので、手順ごとに画像欄から登録してください</li>
        </ul>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 text-[11px] leading-relaxed">{EXAMPLE}</pre>
      </details>

      {busy && !preview && <p className="text-xs text-coffee-500 animate-pulse-soft">読み込み中…</p>}
      {err && <p role="alert" className="text-sm text-rose-600">{err}</p>}

      {preview && (
        <div className="space-y-3 rounded-lg border border-coffee-200 bg-white p-3">
          <div className="text-sm font-semibold">取り込む内容{file && <span className="ml-1.5 font-normal text-coffee-500">({file.name})</span>}</div>
          {preview.warnings.map((w) => <p key={w} className="text-xs text-amber-700">⚠ {w}</p>)}

          <div>
            <div className="text-xs font-semibold text-coffee-500">必要な部品・工具</div>
            {preview.assembly_notes
              ? <Markdown className="mt-1">{preview.assembly_notes}</Markdown>
              : <p className="mt-1 text-xs text-coffee-400">ファイルにないため、いまの内容のままにします</p>}
          </div>

          <div>
            <div className="text-xs font-semibold text-coffee-500">手順 {preview.steps.length} 件</div>
            <ol className="mt-1 space-y-2">
              {preview.steps.map((s, i) => (
                <li key={i} className="rounded-lg border border-coffee-100 p-2.5">
                  <div className="text-[11px] font-bold tracking-[0.15em] text-caramel">STEP {offset + i + 1}</div>
                  {s.title && <div className="text-sm font-semibold">{s.title}</div>}
                  {s.body && <Markdown className="mt-0.5">{s.body}</Markdown>}
                </li>
              ))}
            </ol>
          </div>

          <fieldset className="space-y-1.5 text-sm">
            <legend className="text-xs font-semibold text-coffee-500">取り込み方</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="assembly-import-mode" checked={mode === "append"} onChange={() => setMode("append")} className="accent-caramel" />
              いまの手順の後ろに追加する (部品・工具も後ろに追記)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="assembly-import-mode" checked={mode === "replace"} onChange={() => setMode("replace")} className="accent-caramel" />
              置き換える{currentStepCount > 0 && ` (いまの手順 ${currentStepCount} 件は削除)`}
            </label>
          </fieldset>

          <div className="flex gap-2">
            <button type="button" disabled={busy || (preview.steps.length === 0 && !preview.assembly_notes)} onClick={apply} className="btn btn-primary">
              {busy ? "取り込み中…" : "取り込む"}
            </button>
            <button type="button" disabled={busy} onClick={reset} className="btn btn-outline">キャンセル</button>
          </div>
        </div>
      )}
    </div>
  );
}
