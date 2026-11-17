// SSO (共通の認証サーバー)。仕様は認証サーバー (別リポジトリ) のアプリ連携の手順。
// code_verifier (PKCE) はこのタブの sessionStorage に持ち、交換もブラウザから行う。
// 戻ってきた結果コードは、ここにある code_verifier がないと交換できない (他人に URL を踏ませても成立しない)。
import { api, API_BASE, jsonBody } from "./api";
import type { User } from "./auth";

export type SsoMode = "login" | "link";

export type SsoIdentities = {
  sso_enabled: boolean;
  sso_name: string | null;
  can_link: boolean;
  identities: { provider: string; email: string | null; created_at: string; last_login_at: string | null }[];
  sso_only: boolean;
  login_method: "pwd" | "sso";
};

export type SsoSession = { access_token: string; refresh_token: string; user: User };

const PKCE_KEY = "dr-sso-pkce";

/** SSO が使えるか。使えないとき・取れないときは null (ボタンを出さない) */
export async function fetchSsoName(): Promise<string | null> {
  try {
    const res = await api<{ sso?: boolean; sso_name?: string | null }>("/auth/providers");
    return res.sso ? res.sso_name || "SSO" : null;
  } catch {
    return null;
  }
}

export const fetchSsoIdentities = (token: string | null) => api<SsoIdentities>("/me/identities", { auth: token });
export const unlinkSso = (token: string | null) => api("/me/identities/sso", { method: "DELETE", auth: token });
export const setSsoOnly = (enabled: boolean, token: string | null) =>
  api("/me/sso-only", { method: "PUT", body: jsonBody({ enabled }), auth: token });

function b64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

/** 認証サーバーの画面へ移る。連携のときは、先にログイン中の本人として intent を取る */
export async function startSso(mode: SsoMode, token: string | null = null): Promise<void> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const params = new URLSearchParams({ mode, client: "web", code_challenge: await challengeOf(verifier) });
  if (mode === "link") {
    params.set("intent", (await api<{ intent: string }>("/me/identities/sso/intent", { method: "POST", auth: token })).intent);
  }
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ mode, verifier, at: Date.now() }));
  window.location.href = `${API_BASE}/v1/auth/sso/start?${params}`;
}

/** 戻ってきたときの処理。移る先と、ログインならセッションを返す */
export async function completeSso(
  search: URLSearchParams,
  token: string | null
): Promise<{ to: string; session?: SsoSession }> {
  const raw = sessionStorage.getItem(PKCE_KEY);
  sessionStorage.removeItem(PKCE_KEY);
  const saved = raw ? (JSON.parse(raw) as { mode: SsoMode; verifier: string; at: number }) : null;
  // このタブで始めた流れではない (または 10 分を過ぎた)
  if (!saved || Date.now() - saved.at > 10 * 60 * 1000) return { to: "/login?sso_error=expired" };
  const back = (reason: string) => ({
    to: `${saved.mode === "link" ? "/account" : "/login"}?sso_error=${encodeURIComponent(reason)}`,
  });
  const error = search.get("error");
  const code = search.get("code");
  if (error || !code) return back(error ?? "failed");

  let res: Response;
  try {
    // 401 でトークンを更新し直す api() の処理を通さないよう、ここは fetch で送る
    res = await fetch(`${API_BASE}/v1/auth/sso/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(saved.mode === "link" && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ code, code_verifier: saved.verifier }),
    });
  } catch {
    return back("failed");
  }
  if (!res.ok) return back(res.status === 409 ? "conflict" : res.status === 400 ? "demo" : "failed");
  if (saved.mode === "link") return { to: "/account?sso=linked" };
  const data = (await res.json().catch(() => ({}))) as Partial<SsoSession>;
  if (!data.access_token || !data.refresh_token || !data.user) return back("failed");
  return { to: "/", session: data as SsoSession };
}

export const SSO_COPY = {
  or: "または",
  login: (name: string) => `${name} でログイン`,
  loginHint: (name: string) => `マイページで ${name} を連携した人だけが使えます。`,
  linkTitle: (name: string) => `${name} でログイン`,
  linkDescription: (name: string) =>
    `共通のアカウントと連携すると、ほかのアプリと同じログインで入れます。このアプリには、${name} にパスキーでログインした場合だけ入れます。`,
  linked: "連携しました。",
  linkedAs: (email: string) => `連携済み: ${email}`,
  link: (name: string) => `${name} のアカウントと連携する`,
  unlink: "連携を解除",
  unlinkConfirm: (name: string) => `連携を解除しますか？「${name} だけ」も外れ、パスワードでログインできるようになります。`,
  demoDenied: (name: string) => `デモ用のアカウントには ${name} を連携できません。`,
  ssoOnlyTitle: (name: string, on: boolean) => `${name} だけでログインする: ${on ? "オン" : "オフ"}`,
  ssoOnlyDescription:
    "オンにすると、メールアドレスとパスワードではログインできなくなります。ほかの端末でパスワードで入っているログインも、その時点で切れます。",
  ssoOnlyOn: "オンにする",
  ssoOnlyOff: "オフにする",
  ssoOnlyConfirm: (name: string) => `${name} だけでログインしますか？ メールアドレスとパスワードではログインできなくなります。`,
  ssoOnlyNeedsSso: (name: string) =>
    `オンにするには、いったんログアウトして「${name} でログイン」で入り直してください (${name} で入れることを確かめるため)。`,
  signingIn: "ログインしています…",
} as const;

/** API から戻ってきた error を、画面に出す文に変える */
export function ssoErrorMessage(reason: string | null | undefined, mode: SsoMode, name = "SSO"): string | null {
  if (!reason) return null;
  switch (reason) {
    case "not_linked":
      return `この ${name} のアカウントは連携されていません。メールアドレスとパスワードでログインし、マイページで連携してください。`;
    case "mfa_required":
      return `このアプリは 2 段階認証が必須です。${name} にパスキーでログインしてから、もう一度お試しください。`;
    case "cancelled":
      return mode === "login" ? `${name} でのログインを中止しました。` : `${name} との連携を中止しました。`;
    case "expired":
      return "有効期限が切れました。もう一度やり直してください。";
    case "conflict":
      return `この ${name} のアカウントは、ほかの利用者に連携されているか、すでに別のアカウントと連携済みです。`;
    case "demo":
      return `デモ用のアカウントには ${name} を連携できません。`;
    default:
      return mode === "login"
        ? `${name} でログインできませんでした。もう一度お試しください。`
        : `${name} と連携できませんでした。もう一度お試しください。`;
  }
}
