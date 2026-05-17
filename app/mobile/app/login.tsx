import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { Link, router } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('member@example.com');
  const [password, setPassword] = useState('password');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null); setBusy(true);
    try {
      await login(email, password);
      router.replace('/(tabs)/account');
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
      <Link href="/register" style={{ color: '#2563eb', marginTop: 12, textAlign: 'center' }}>会員登録はこちら</Link>
      <Text style={{ opacity: 0.5, fontSize: 12, marginTop: 16, textAlign: 'center' }}>
        テスト: member@example.com / password{'\n'}管理者: admin@example.com / password
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  label: { marginTop: 12, fontSize: 12, opacity: 0.6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, marginTop: 4 },
  button: { marginTop: 16, backgroundColor: '#111', padding: 12, borderRadius: 6, alignItems: 'center' },
});
