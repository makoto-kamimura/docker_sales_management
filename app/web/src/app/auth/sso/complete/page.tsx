"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { readStoredAccessToken, useAuth } from "@/lib/auth";
import { completeSso, SSO_COPY } from "@/lib/sso";

/** 認証サーバーから API を経由して戻ってくる。結果コードと sessionStorage の code_verifier を交換する */
export default function SsoCompletePage() {
  const { adopt } = useAuth();
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return; // 開発時の StrictMode の 2 回目の実行で、使い捨ての結果コードを再送しない
    done.current = true;
    void completeSso(new URLSearchParams(window.location.search), readStoredAccessToken()).then(({ to, session }) => {
      if (session) adopt(session, session.user);
      router.replace(to);
    });
  }, [adopt, router]);

  return <p className="card p-6 text-sm text-coffee-500 max-w-md mx-auto">{SSO_COPY.signingIn}</p>;
}
