export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? "http://localhost/api";

type FetchOpts = RequestInit & { auth?: string | null };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (!headers.has("Content-Type") && opts.body && typeof opts.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  if (opts.auth) headers.set("Authorization", `Bearer ${opts.auth}`);

  const res = await fetch(`${API_BASE}/v1${path}`, { ...opts, headers });
  if (!res.ok) {
    let body: { error?: { code: string; message: string } } = {};
    try { body = await res.json(); } catch { /* ignore */ }
    throw new ApiError(res.status, body.error?.code ?? "unknown", body.error?.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const jsonBody = (data: unknown) => JSON.stringify(data);

/** API が返すサーバー相対パス (/rails/...) を API と同じオリジンの絶対 URL にする。
 *  React Native の URL は相対パスを正しく解決しないので、オリジンを切り出して連結する */
export function apiOriginUrl(path: string) {
  const origin = API_BASE.match(/^https?:\/\/[^/]+/)?.[0] ?? '';
  return `${origin}${path}`;
}

/** 購入済み3Dモデルデータの期限付きダウンロードURLを取得する */
export async function fetchDownloadUrl(productId: number, token: string | null) {
  const { url } = await api<{ url: string }>(`/downloads/${productId}`, { auth: token });
  return apiOriginUrl(url);
}

/** 購入した3Dモデルの組み立て説明書 (PDF) の期限付きURLを取得する */
export async function fetchAssemblyGuideUrl(productId: number, token: string | null) {
  const { url } = await api<{ url: string }>(`/downloads/${productId}/assembly`, { auth: token });
  return apiOriginUrl(url);
}
