"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("member@example.com");
  const [password, setPassword] = useState("password");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button disabled={busy} className="btn btn-primary w-full">
          ログイン
        </button>
      </form>
      <p className="text-xs text-coffee-500 mt-5 rounded-lg bg-coffee-50 p-3 leading-relaxed">
        テスト: member@example.com / password<br />管理者: admin@example.com / password
      </p>
    </div>
  );
}
