import { useEffect } from 'react';
import { router } from 'expo-router';

/**
 * 認証サーバーから戻るディープリンク (craftflow://auth/sso?code=…) の受け口。
 * 結果は開いた画面 (lib/sso.ts の openAuthSessionAsync) が受け取るので、ここに来たらすぐに戻す。
 */
export default function SsoRedirect() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/account');
  }, []);
  return null;
}
