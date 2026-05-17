import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { router } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/lib/auth';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null); setBusy(true);
    try {
      await register(email, password, name);
      router.replace('/(tabs)/account');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'エラー');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={styles.label}>お名前</Text>
      <TextInput value={name} onChangeText={setName} style={styles.input} />
      <Text style={styles.label}>メール</Text>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <Text style={styles.label}>パスワード (8文字以上)</Text>
      <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
      {err && <Text style={{ color: '#dc2626', marginTop: 8 }}>{err}</Text>}
      <Pressable onPress={submit} disabled={busy} style={styles.button}>
        <Text style={{ color: '#fff' }}>{busy ? '...' : '登録'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 12, fontSize: 12, opacity: 0.6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, marginTop: 4 },
  button: { marginTop: 16, backgroundColor: '#111', padding: 12, borderRadius: 6, alignItems: 'center' },
});
