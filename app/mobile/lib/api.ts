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
