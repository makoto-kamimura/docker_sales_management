import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Link, Stack, router, useLocalSearchParams } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { api, jsonBody } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen } from '@/lib/format';
import type { Order, Product, RequestKind } from '@/lib/types';

const ACCENT = '#ff5722';

// 問い合わせ (inquiry) / オーダーメイド制作依頼 (custom)
export default function ServiceRequestScreen() {
  const params = useLocalSearchParams<{ kind?: string; order_id?: string; product_id?: string }>();
  const kind: RequestKind = params.kind === 'custom' ? 'custom' : 'inquiry';
  const { token } = useAuth();

  const [menu, setMenu] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [productId, setProductId] = useState<number | null>(params.product_id ? Number(params.product_id) : null);
  const [orderId, setOrderId] = useState<number | null>(params.order_id ? Number(params.order_id) : null);
  const [subject, setSubject] = useState('');
  const [preferredAt, setPreferredAt] = useState('');
  const [budget, setBudget] = useState('');
  const [body, setBody] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const title = kind === 'custom' ? 'オーダーメイド制作の依頼' : 'お問い合わせ';

  // オーダーメイド: 制作メニュー / 問い合わせ: 対象の注文
  const loadChoices = useCallback(async () => {
    try {
      if (kind === 'custom') setMenu(await api<Product[]>('/products?category_slug=custom'));
      else if (token) setOrders(await api<Order[]>('/orders', { auth: token }));
    } catch {
      setMenu([]); setOrders([]);
    }
  }, [kind, token]);

  useEffect(() => { loadChoices(); }, [loadChoices]);

  async function submit() {
    if (!token) { router.push('/login'); return; }
    setBusy(true); setErr(null);
    try {
      await api('/service_requests', {
        method: 'POST',
        body: jsonBody({
          kind,
          subject,
          body,
          contact_phone: phone,
          product_id: kind === 'custom' ? productId : null,
          order_id: kind === 'inquiry' ? orderId : null,
          preferred_at: kind === 'custom' && preferredAt ? preferredAt : null,
          budget_cents: kind === 'custom' && budget ? Number(budget) : null,
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

      {kind === 'custom' ? (
        <>
          <Text style={styles.label}>制作メニュー（任意）</Text>
          <View style={styles.chips}>
            <Chip label="選択しない" active={productId === null} onPress={() => setProductId(null)} />
            {menu.map((m) => (
              <Chip key={m.id} label={`${m.name}（${yen(m.price_cents)}〜）`} active={productId === m.id} onPress={() => setProductId(m.id)} />
            ))}
          </View>
        </>
      ) : (
        orders.length > 0 && (
          <>
            <Text style={styles.label}>対象の注文（任意）</Text>
            <View style={styles.chips}>
              <Chip label="選択しない" active={orderId === null} onPress={() => setOrderId(null)} />
              {orders.slice(0, 8).map((o) => (
                <Chip key={o.id} label={`#${o.id} ${o.status_label}`} active={orderId === o.id} onPress={() => setOrderId(o.id)} />
              ))}
            </View>
          </>
        )
      )}

      <Text style={styles.label}>{kind === 'custom' ? '作りたいもの' : '件名'}</Text>
      <TextInput value={subject} onChangeText={setSubject} style={styles.input}
                 placeholder={kind === 'custom' ? '例: イニシャル入りの名刺入れ' : '例: 納期について'} />

      {kind === 'custom' && (
        <>
          <Text style={styles.label}>希望納期（任意）</Text>
          <TextInput value={preferredAt} onChangeText={setPreferredAt} style={styles.input} placeholder="例: 2026-10-01" />
          <Text style={styles.label}>ご予算（円・任意）</Text>
          <TextInput value={budget} onChangeText={setBudget} keyboardType="number-pad" style={styles.input} placeholder="例: 8000" />
        </>
      )}

      <Text style={styles.label}>{kind === 'custom' ? 'ご依頼内容（サイズ・素材・色・数量など）' : 'お問い合わせ内容'}</Text>
      <TextInput value={body} onChangeText={setBody} multiline style={[styles.input, styles.textarea]}
                 placeholder={kind === 'custom' ? '例: ヌメ革の名刺入れに「H.S」と刻印してほしい' : '例: いつ頃発送になりますか？'} />

      <Text style={styles.label}>連絡先電話番号（任意）</Text>
      <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholder="090-0000-0000" />

      {err && <Text style={styles.err}>{err}</Text>}

      <Pressable onPress={submit} disabled={busy} style={styles.button}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>{busy ? '送信中…' : (kind === 'custom' ? '制作を依頼する' : '送信する')}</Text>
      </Pressable>

      <Link href="/requests" style={styles.link}>問い合わせ一覧を見る →</Link>
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
