"use client";

import { useState } from "react";
import { Markdown } from "@/components/Markdown";

/**
 * 問い合わせ・依頼の本文。Markdown として整形して出す (AIコンシェルジュ経由の依頼は制作依頼書の Markdown。
 * フォームの文章も、改行はそのまま改行として出る)。長いものは折りたたみ、「全文を見る」で開く
 */
export function RequestBody({ body, collapsedClass = "max-h-28" }: { body: string; collapsedClass?: string }) {
  const long = body.length > 240 || body.split("\n").length > 6;
  const [expanded, setExpanded] = useState(false);
  const collapsed = long && !expanded;
  return (
    <div>
      <div className={`relative ${collapsed ? `${collapsedClass} overflow-hidden` : ""}`}>
        <Markdown>{body}</Markdown>
        {collapsed && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white" />}
      </div>
      {long && (
        <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}
                className="mt-1 text-xs font-semibold text-caramel hover:underline">
          {expanded ? "たたむ" : "全文を見る"}
        </button>
      )}
    </div>
  );
}

/** AIコンシェルジュ経由の依頼の目印 */
export function ConciergeBadge() {
  return (
    <span className="rounded-full bg-caramel/10 px-2 py-0.5 text-[10px] font-semibold text-caramel">AIコンシェルジュ経由</span>
  );
}
