import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Link, Stack, router, useLocalSearchParams } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { api, jsonBody } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen } from '@/lib/format';
import type { Product, ServiceKind } from '@/lib/types';

const ACCENT = '#ff5722';

export default function ServiceRequestScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: ServiceKind = params.kind === 'system' ? 'system' : 'maintenance';
  const { token } = useAuth();

  const [menu, setMenu] = useState<Product[]>([]);
  const [productId, setProductId] = useState<number | null>(null);
  const [vehicle, setVehicle] = useState('');
  const [preferredAt, setPreferredAt] = useState('');
  const [budget, setBudget] = useState('');
  const [body, setBody] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const title = kind === 'maintenance' ? '整備の予約' : 'システム開発依頼';

  const loadMenu = useCallback(async () => {
    try {
      setMenu(await api<Product[]>(`/products?category_slug=${kind}`));
    } catch {
      setMenu([]);
    }
  }, [kind]);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  async function submit() {
    if (!token) { router.push('/login'); return; }
    setBusy(true); setErr(null);
    try {
      await api('/service_requests', {
        method: 'POST',
        body: jsonBody({
          kind,
          product_id: productId,
          vehicle,
          body,
          contact_phone: phone,
          preferred_at: kind === 'maintenance' && preferredAt ? preferredAt : null,
          budget_cents: kind === 'system' && budget ? Number(budget) : null,
        }),
        auth: token,
      });
      router.replace('/requests');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '送信に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title }} />

      {!token && (
        <Text style={styles.notice}>送信にはログインが必要です。送信時にログイン画面へ移動します。</Text>
      )}

      <Text style={styles.label}>{kind === 'maintenance' ? '整備メニュー' : 'システム / 機器'}（任意）</Text>
      <View style={styles.chips}>
        <Chip label="選択しない" active={productId === null} onPress={() => setProductId(null)} />
        {menu.map((m) => (
          <Chip key={m.id} label={`${m.name}（${yen(m.price_cents)}）`} active={productId === m.id} onPress={() => setProductId(m.id)} />
        ))}
      </View>

      <Text style={styles.label}>車種・型式</Text>
      <TextInput value={vehicle} onChangeText={setVehicle} style={styles.input} placeholder="例: CB400SF / 2018年式" />

      {kind === 'maintenance' && (
        <>
          <Text style={styles.label}>希望日時</Text>
          <TextInput value={preferredAt} onChangeText={setPreferredAt} style={styles.input} placeholder="例: 2026-06-20 10:00" />
        </>
      )}

      {kind === 'system' && (
        <>
          <Text style={styles.label}>想定予算（円・任意）</Text>
          <TextInput value={budget} onChangeText={setBudget} keyboardType="number-pad" style={styles.input} placeholder="例: 50000" />
        </>
      )}

      <Text style={styles.label}>{kind === 'maintenance' ? '整備内容・ご相談' : 'ご依頼内容・要件'}</Text>
      <TextInput value={body} onChangeText={setBody} multiline style={[styles.input, styles.textarea]}
                 placeholder={kind === 'maintenance' ? '例: 12ヶ月点検とチェーン清掃' : '例: ナビとインカムを取り付けたい'} />

      <Text style={styles.label}>連絡先電話番号（任意）</Text>
      <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholder="090-0000-0000" />

      {err && <Text style={styles.err}>{err}</Text>}

      <Pressable onPress={submit} disabled={busy} style={styles.button}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>{busy ? '送信中…' : (kind === 'maintenance' ? '予約を申し込む' : '開発依頼を送信する')}</Text>
      </Pressable>

      <Link href="/requests" style={styles.link}>依頼状況を見る →</Link>
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={{ fontSize: 12, color: active ? '#fff' : '#1b1b19' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notice: { fontSize: 12, color: '#686863', backgroundColor: '#ededea', padding: 10, borderRadius: 8, marginBottom: 12 },
  label: { marginTop: 14, fontSize: 12, fontWeight: '600', color: '#686863' },
  input: { borderWidth: 1, borderColor: '#dededa', borderRadius: 8, padding: 10, marginTop: 4, backgroundColor: '#fff' },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { borderWidth: 1, borderColor: '#dededa', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  err: { color: '#dc2626', marginTop: 12 },
  button: { marginTop: 20, backgroundColor: ACCENT, padding: 14, borderRadius: 10, alignItems: 'center' },
  link: { color: ACCENT, marginTop: 16, textAlign: 'center' },
});
