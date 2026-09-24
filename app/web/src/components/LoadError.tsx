"use client";

/** 一覧の取得に失敗したときの表示 (読み込み中のまま止まらないようにする) */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="card space-y-3 p-6 text-sm text-coffee-600">
      <p>
        読み込みに失敗しました。
        {error instanceof Error && error.message && <span className="text-coffee-400">（{error.message}）</span>}
      </p>
      <button type="button" onClick={onRetry} className="btn btn-outline">再読み込み</button>
    </div>
  );
}
