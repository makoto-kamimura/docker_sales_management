import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { api, jsonBody } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen } from '@/lib/format';
import type { Product } from '@/lib/types';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [p, setP] = useState<Product | null>(null);
  const [qty, setQty] = useState('1');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setP(await api<Product>(`/products/${id}`)); } catch { /* ignore */ }
    })();
  }, [id]);

  async function add() {
    if (!token) { router.push('/login'); return; }
    setMsg(null);
    try {
      await api('/cart/items', { method: 'POST', body: jsonBody({ product_id: Number(id), quantity: Number(qty) || 1 }), auth: token });
      setMsg('カートに追加しました');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'エラー');
    }
  }

  if (!p) return <Text style={{ padding: 16 }}>読み込み中…</Text>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ opacity: 0.5, fontSize: 12 }}>{p.sku}</Text>
      <Text style={styles.title}>{p.name}</Text>
      <Text style={{ marginVertical: 12 }}>{p.description}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {p.tags.map((t) => (
          <Text key={t} style={styles.tag}>{t}</Text>
        ))}
      </View>
      <Text style={styles.price}>{yen(p.price_cents)}</Text>
      <Text style={{ color: p.in_stock ? '#059669' : '#dc2626', marginTop: 4 }}>
        {p.in_stock ? `在庫: ${p.stock ?? 'あり'}` : '在庫切れ'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
        <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" style={styles.qty} />
        <Pressable onPress={add} disabled={!p.in_stock} style={[styles.button, !p.in_stock && { opacity: 0.4 }]}>
          <Text style={{ color: '#fff' }}>カートに追加</Text>
        </Pressable>
      </View>
      {msg && <Text style={{ marginTop: 8 }}>{msg}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  tag: { backgroundColor: '#eee', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, fontSize: 12 },
  price: { fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  qty: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, width: 60, textAlign: 'center' },
  button: { backgroundColor: '#111', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6 },
});
