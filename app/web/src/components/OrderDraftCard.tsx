"use client";

import { useState, type ReactNode } from "react";
import { Markdown } from "@/components/Markdown";

/** AIコンシェルジュが提示したオーダーメイドの下書き (制作依頼書) と、その下の操作 (はい / 修正する など) */
export function OrderDraftCard({ title, markdown, children }: { title: string; markdown: string; children?: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="w-full max-w-[92%] overflow-hidden rounded-2xl border border-caramel/60 bg-white shadow-soft">
      <div className="border-b border-coffee-100 bg-caramel/10 px-3.5 py-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-caramel">制作依頼書</div>
        <div className="text-sm font-semibold leading-snug text-coffee-900">{title}</div>
      </div>
      <div className={`relative px-3.5 py-2.5 ${expanded ? "" : "max-h-48 overflow-hidden"}`}>
        <Markdown className="!text-[13px]">{markdown}</Markdown>
        {!expanded && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white" />}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full border-t border-coffee-100 py-1.5 text-[11px] font-semibold text-coffee-500 transition-colors hover:text-caramel"
      >
        {expanded ? "たたむ" : "全文を見る"}
      </button>
      {children && <div className="border-t border-coffee-100 bg-coffee-50/60 px-3.5 py-2.5">{children}</div>}
    </div>
  );
}
