import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/lib/auth';
import { fetchSsoIdentities, setSsoOnly, signInWithSso, SSO_COPY, unlinkSso, type SsoIdentities } from '@/lib/sso';

/** アカウントのタブの SSO の欄: 連携・解除と「SSO だけでログインする」 */
export function SsoSection() {
  const { token } = useAuth();
  const [ids, setIds] = useState<SsoIdentities | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    fetchSsoIdentities(token).then(setIds, () => setIds(null));
  }, [token]);
  useEffect(load, [load]);

  if (!ids?.sso_enabled) return null;
  const name = ids.sso_name || 'SSO';
  const sso = ids.identities.find((i) => i.provider === 'sso');

  async function run(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try {
      const ok = await fn();
      if (done && ok) Alert.alert(done);
      load();
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const confirm = (title: string, label: string, onOk: () => void) =>
    Alert.alert(title, undefined, [
      { text: 'キャンセル', style: 'cancel' },
      { text: label, style: 'destructive', onPress: onOk },
    ]);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{SSO_COPY.linkTitle(name)}</Text>
      <Text style={styles.help}>{SSO_COPY.linkDescription(name)}</Text>
      {sso ? (
        <>
          <Text style={styles.body}>{SSO_COPY.linkedAs(sso.email ?? name)}</Text>
          <Text style={styles.body}>{SSO_COPY.ssoOnlyTitle(name, ids.sso_only)}</Text>
          <Text style={styles.help}>{SSO_COPY.ssoOnlyDescription}</Text>
          {ids.sso_only ? (
            <Button title={SSO_COPY.ssoOnlyOff} disabled={busy} onPress={() => run(() => setSsoOnly(false, token))} />
          ) : ids.login_method === 'sso' ? (
            <Button
              title={SSO_COPY.ssoOnlyOn}
              disabled={busy}
              onPress={() => confirm(SSO_COPY.ssoOnlyConfirm(name), SSO_COPY.ssoOnlyOn, () => run(() => setSsoOnly(true, token)))}
            />
          ) : (
            <Text style={styles.help}>{SSO_COPY.ssoOnlyNeedsSso(name)}</Text>
          )}
          <Button
            title={SSO_COPY.unlink}
            disabled={busy}
            onPress={() => confirm(SSO_COPY.unlinkConfirm(name), SSO_COPY.unlink, () => run(() => unlinkSso(token)))}
          />
        </>
      ) : ids.can_link ? (
        <Button title={SSO_COPY.link(name)} disabled={busy} onPress={() => run(() => signInWithSso('link', name, token), SSO_COPY.linked)} />
      ) : (
        <Text style={styles.body}>{SSO_COPY.demoDenied(name)}</Text>
      )}
    </View>
  );
}

function Button({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.button, disabled && { opacity: 0.5 }]}>
      <Text>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 16, padding: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
  title: { fontWeight: '600', fontSize: 15 },
  help: { fontSize: 12, opacity: 0.6, marginTop: 6 },
  body: { marginTop: 8 },
  button: { marginTop: 10, padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, alignItems: 'center' },
});
