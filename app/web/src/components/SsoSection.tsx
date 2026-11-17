"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  fetchSsoIdentities,
  setSsoOnly,
  SSO_COPY,
  ssoErrorMessage,
  startSso,
  unlinkSso,
  type SsoIdentities,
} from "@/lib/sso";

/** マイページの SSO の欄: 連携・解除と「SSO だけでログインする」 */
export function SsoSection() {
  const { token } = useAuth();
  const [ids, setIds] = useState<SsoIdentities | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // 連携から戻ってきたとき (?sso=linked / ?sso_error=…) の結果。読んだらアドレスから消す
  const [notice] = useState(() => {
    if (typeof window === "undefined") return { linked: false, error: null as string | null };
    const q = new URLSearchParams(window.location.search);
    return { linked: q.get("sso") === "linked", error: q.get("sso_error") };
  });

  const load = useCallback(() => {
    if (!token) return;
    fetchSsoIdentities(token).then(setIds, () => setIds(null));
  }, [token]);

  useEffect(() => {
    if (notice.linked || notice.error) window.history.replaceState(null, "", window.location.pathname);
  }, [notice]);
  useEffect(load, [load]);

  if (!ids?.sso_enabled) return null;
  const name = ids.sso_name || "SSO";
  const sso = ids.identities.find((i) => i.provider === "sso");
  const shownErr = err ?? ssoErrorMessage(notice.error, "link", name);
  const shownInfo = info ?? (notice.linked ? SSO_COPY.linked : null);

  async function run(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      await fn();
      if (done) setInfo(done);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6 space-y-3">
      <h2 className="font-semibold">{SSO_COPY.linkTitle(name)}</h2>
      <p className="text-sm text-coffee-500">{SSO_COPY.linkDescription(name)}</p>
      {shownErr && <p className="text-sm text-rose-600">{shownErr}</p>}
      {shownInfo && <p className="text-sm text-emerald-700">{shownInfo}</p>}
      {sso ? (
        <>
          <p className="text-sm">{SSO_COPY.linkedAs(sso.email ?? name)}</p>
          <p className="text-sm">{SSO_COPY.ssoOnlyTitle(name, ids.sso_only)}</p>
          <p className="text-xs text-coffee-500">{SSO_COPY.ssoOnlyDescription}</p>
          <div className="flex flex-wrap gap-2">
            {ids.sso_only ? (
              <button className="btn" disabled={busy} onClick={() => run(() => setSsoOnly(false, token))}>
                {SSO_COPY.ssoOnlyOff}
              </button>
            ) : (
              <button
                className="btn"
                disabled={busy || ids.login_method !== "sso"}
                onClick={() => window.confirm(SSO_COPY.ssoOnlyConfirm(name)) && run(() => setSsoOnly(true, token))}
              >
                {SSO_COPY.ssoOnlyOn}
              </button>
            )}
            <button
              className="btn"
              disabled={busy}
              onClick={() => window.confirm(SSO_COPY.unlinkConfirm(name)) && run(() => unlinkSso(token))}
            >
              {SSO_COPY.unlink}
            </button>
          </div>
          {!ids.sso_only && ids.login_method !== "sso" && (
            <p className="text-xs text-coffee-500">{SSO_COPY.ssoOnlyNeedsSso(name)}</p>
          )}
        </>
      ) : ids.can_link ? (
        <button className="btn" disabled={busy} onClick={() => run(() => startSso("link", token))}>
          {SSO_COPY.link(name)}
        </button>
      ) : (
        <p className="text-sm text-coffee-500">{SSO_COPY.demoDenied(name)}</p>
      )}
    </section>
  );
}
