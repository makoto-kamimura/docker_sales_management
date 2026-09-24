"use client";

import { useId, useState } from "react";
import { Markdown } from "./Markdown";

/**
 * Markdown の入力欄とライブプレビュー。広い画面は左右に並べ、狭い画面は「編集 / プレビュー」を切り替える。
 * textarea に name を付けているので、フォームの FormData でそのまま送れる
 */
export function MarkdownField({ name, label, defaultValue = "", rows = 6, placeholder }: {
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const id = useId();

  const tabButton = (key: "edit" | "preview", text: string) => (
    <button type="button" onClick={() => setTab(key)} aria-pressed={tab === key}
            className={`rounded-md px-2 py-0.5 ${tab === key ? "bg-espresso text-coffee-50" : "text-coffee-600 hover:bg-coffee-100"}`}>
      {text}
    </button>
  );

  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={id} className="field-label">{label}</label>
        <div className="mb-1 flex gap-1 text-xs lg:hidden">
          {tabButton("edit", "編集")}
          {tabButton("preview", "プレビュー")}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <textarea
          id={id}
          name={name}
          rows={rows}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={`input font-mono text-[13px] leading-relaxed ${tab === "preview" ? "hidden lg:block" : ""}`}
        />
        <div
          aria-label={`${label}のプレビュー`}
          className={`min-h-24 rounded-xl border border-dashed border-coffee-200 bg-white p-3 ${tab === "edit" ? "hidden lg:block" : ""}`}
        >
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-xs text-coffee-400">プレビューがここに表示されます</p>}
        </div>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-coffee-400">
        Markdown で書けます: <code>**太字**</code>・<code>- 箇条書き</code>・<code>1. 番号付き</code>・<code>## 見出し</code>・
        <code>`コード`</code>・<code>&gt; 注意書き</code>・<code>[リンク](https://…)</code>。改行はそのまま反映されます。
      </p>
    </div>
  );
}
