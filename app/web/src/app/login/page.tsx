"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { fetchSsoName, SSO_COPY, ssoErrorMessage, startSso } from "@/lib/sso";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sso, setSso] = useState<string | null>(null);
  // SSO から戻ってきたときの理由 (?sso_error=…)。サーバー側の描画とずれないよう、表示してから読む
  const [ssoError, setSsoError] = useState<string | null>(null);

  useEffect(() => {
    setSsoError(new URLSearchParams(window.location.search).get("sso_error"));
    fetchSsoName().then(setSso);
  }, []);

  async function onSso() {
    setErr(null); setBusy(true);
    try {
      await startSso("login");
    } catch {
      setErr(ssoErrorMessage("failed", "login", sso ?? "SSO"));
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto card p-7 sm:p-8">
      <div className="text-center mb-6">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-espresso text-xs font-bold tracking-wide text-coffee-50 shadow-soft">R&amp;R</div>
        <h1 className="text-xl font-bold mt-3">おかえりなさい</h1>
        <p className="text-sm text-coffee-500 mt-1">アカウントにログイン</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="field-label">メールアドレス</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                 className="input" />
        </label>
        <label className="block">
          <span className="field-label">パスワード</span>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                 className="input" />
        </label>
        {(err || ssoError) && (
          <p className="text-sm text-rose-600">{err ?? ssoErrorMessage(ssoError, "login", sso ?? "SSO")}</p>
        )}
        <button disabled={busy} className="btn btn-primary w-full">
          ログイン
        </button>
      </form>
      {sso && (
        <div className="mt-5 space-y-2 text-center">
          <p className="text-xs text-coffee-500">{SSO_COPY.or}</p>
          <button type="button" disabled={busy} onClick={onSso} className="btn w-full">
            {SSO_COPY.login(sso)}
          </button>
          <p className="text-xs text-coffee-500">{SSO_COPY.loginHint(sso)}</p>
        </div>
      )}
    </div>
  );
}
