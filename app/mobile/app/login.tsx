import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { Link } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/lib/auth';
import { routeAfterLogin } from '@/lib/concierge';
import { fetchSsoName, signInWithSso, SSO_COPY } from '@/lib/sso';

export default function LoginScreen() {
  const { login, adopt } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sso, setSso] = useState<string | null>(null);

  useEffect(() => {
    fetchSsoName().then(setSso);
  }, []);

  async function ssoLogin() {
    setErr(null); setBusy(true);
    try {
      const session = await signInWithSso('login', sso ?? 'SSO');
      if (session && session !== true) {
        await adopt(session, session.user);
        await routeAfterLogin();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'エラー');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setErr(null); setBusy(true);
    try {
      await login(email, password);
      await routeAfterLogin();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'エラー');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>メール</Text>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <Text style={styles.label}>パスワード</Text>
      <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
      {err && <Text style={{ color: '#dc2626', marginTop: 8 }}>{err}</Text>}
      <Pressable onPress={submit} disabled={busy} style={styles.button}>
        <Text style={{ color: '#fff' }}>{busy ? '...' : 'ログイン'}</Text>
      </Pressable>
      {sso && (
        <>
          <Text style={{ marginTop: 16, textAlign: 'center', opacity: 0.6 }}>{SSO_COPY.or}</Text>
          <Pressable onPress={ssoLogin} disabled={busy} style={styles.ssoButton}>
            <Text>{SSO_COPY.login(sso)}</Text>
          </Pressable>
          <Text style={{ marginTop: 6, fontSize: 12, opacity: 0.6, textAlign: 'center' }}>{SSO_COPY.loginHint(sso)}</Text>
        </>
      )}
      <Link href="/register" style={{ color: '#2563eb', marginTop: 12, textAlign: 'center' }}>会員登録はこちら</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  label: { marginTop: 12, fontSize: 12, opacity: 0.6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, marginTop: 4 },
  button: { marginTop: 16, backgroundColor: '#111', padding: 12, borderRadius: 6, alignItems: 'center' },
  ssoButton: { marginTop: 8, borderWidth: 1, borderColor: '#111', padding: 12, borderRadius: 6, alignItems: 'center' },
});
