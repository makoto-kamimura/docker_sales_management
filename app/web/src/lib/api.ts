// SSR (Node.js) からは Docker network 内のホスト名で API へ到達する必要がある。
// ブラウザからは localhost (ホストマシンの :80 → Nginx) で到達する。
const isServer = typeof window === "undefined";

export const API_BASE = isServer
  ? process.env.API_BASE_INTERNAL ?? "http://api:3000/api"
  : process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost/api";

type FetchOpts = RequestInit & { auth?: string | null; raw?: boolean };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

// 認証つきリクエストが 401 のときに呼ぶトークン更新処理 (AuthProvider が登録する)。
// 新しいアクセストークンを返す。更新できなければ null (ログアウト済み)
let refreshAuth: (() => Promise<string | null>) | null = null;

export function setAuthRefresher(fn: (() => Promise<string | null>) | null) {
  refreshAuth = fn;
}

export async function api<T = unknown>(
  path: string,
  opts: FetchOpts = {},
  retried = false
): Promise<T> {
  const headers = new Headers(opts.headers);
  if (!headers.has("Content-Type") && opts.body && typeof opts.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  if (opts.auth) headers.set("Authorization", `Bearer ${opts.auth}`);

  const res = await fetch(`${API_BASE}/v1${path}`, { ...opts, headers, cache: "no-store" });
  // アクセストークン (有効期限1時間) が切れていたら、更新して1回だけやり直す
  if (res.status === 401 && opts.auth && !retried && refreshAuth) {
    const fresh = await refreshAuth();
    if (fresh) return api<T>(path, { ...opts, auth: fresh }, true);
  }
  if (!res.ok) {
    let body: { error?: { code: string; message: string } } = {};
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    // HTTP/2 では statusText が空なので、API 以外 (WAF・プロキシ) のエラーでも画面に出せる文言にする
    throw new ApiError(res.status, body.error?.code ?? "unknown", body.error?.message || httpErrorMessage(res.status));
  }
  if (opts.raw) return res as unknown as T; // バイナリ (PDF など) は呼び出し側で読む
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** 認証が必要なファイル (管理画面の PDF など) を取得して保存する */
export async function downloadAuthedFile(path: string, token: string | null, fallbackName: string) {
  const res = await api<Response>(path, { auth: token, raw: true });
  const blob = await res.blob();
  const encoded = res.headers.get("Content-Disposition")?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const href = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href, download: encoded ? decodeURIComponent(encoded) : fallbackName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

function httpErrorMessage(status: number) {
  if (status === 413) return "ファイルが大きすぎます";
  if (status === 403) return "リクエストが拒否されました (403)";
  if (status >= 500) return `サーバーでエラーが発生しました (${status})`;
  return `通信エラーが発生しました (${status})`;
}

export const jsonBody = (data: unknown) => JSON.stringify(data);

/** API が返すサーバー相対パス (/rails/...) を API と同じオリジンの絶対 URL にする */
export function apiOriginUrl(path: string) {
  const base = new URL(API_BASE, isServer ? "http://localhost" : window.location.href);
  return new URL(path, base).toString();
}

/** 購入済み3Dモデルデータを期限付きURL経由でダウンロードする */
export async function downloadModel(productId: number, token: string | null) {
  const { url } = await api<{ url: string }>(`/downloads/${productId}`, { auth: token });
  window.location.assign(apiOriginUrl(url));
}

/** 購入した3Dモデルの組み立て説明書 (PDF) を期限付きURL経由でダウンロードする */
export async function downloadAssemblyGuide(productId: number, token: string | null) {
  const { url } = await api<{ url: string }>(`/downloads/${productId}/assembly`, { auth: token });
  window.location.assign(apiOriginUrl(url));
}
