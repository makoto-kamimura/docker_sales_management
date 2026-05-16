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

export async function api<T = unknown>(
  path: string,
  opts: FetchOpts = {}
): Promise<T> {
  const headers = new Headers(opts.headers);
  if (!headers.has("Content-Type") && opts.body && typeof opts.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  if (opts.auth) headers.set("Authorization", `Bearer ${opts.auth}`);

  const res = await fetch(`${API_BASE}/v1${path}`, { ...opts, headers, cache: "no-store" });
  if (!res.ok) {
    let body: { error?: { code: string; message: string } } = {};
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, body.error?.code ?? "unknown", body.error?.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const jsonBody = (data: unknown) => JSON.stringify(data);
