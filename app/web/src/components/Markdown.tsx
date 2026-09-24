"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

// 管理画面の文章 (組み立て手順など) 用の見た目。生の HTML と画像は表示しない
const components: Components = {
  h1: ({ children }) => <h3 className="mb-1.5 mt-3 text-base font-bold text-coffee-900 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h4 className="mb-1.5 mt-3 text-[15px] font-bold text-coffee-900 first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="mb-1 mt-2.5 text-sm font-bold text-coffee-900 first:mt-0">{children}</h5>,
  h4: ({ children }) => <h6 className="mb-1 mt-2 text-sm font-semibold text-coffee-900 first:mt-0">{children}</h6>,
  h5: ({ children }) => <h6 className="mb-1 mt-2 text-sm font-semibold text-coffee-900 first:mt-0">{children}</h6>,
  h6: ({ children }) => <h6 className="mb-1 mt-2 text-sm font-semibold text-coffee-900 first:mt-0">{children}</h6>,
  p: ({ children }) => <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5 marker:text-caramel">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5 marker:text-caramel">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-coffee-200 pl-3 text-coffee-600">{children}</blockquote>,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-coffee-100/70 p-3 text-xs [&_code]:bg-transparent [&_code]:p-0">{children}</pre>
  ),
  code: ({ children }) => <code className="rounded bg-coffee-100 px-1 py-0.5 text-[0.9em] text-coffee-800">{children}</code>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-caramel underline underline-offset-2">{children}</a>
  ),
  strong: ({ children }) => <strong className="font-bold text-coffee-900">{children}</strong>,
  hr: () => <hr className="my-3 border-coffee-200" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-coffee-200 bg-coffee-50 px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-coffee-200 px-2 py-1">{children}</td>,
};

/** Markdown (GFM・改行はそのまま改行) を表示する */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`break-words text-sm text-coffee-700 ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}
                     disallowedElements={["img"]} unwrapDisallowed skipHtml>
        {children}
      </ReactMarkdown>
    </div>
  );
}
