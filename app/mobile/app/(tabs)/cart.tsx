import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { api, jsonBody } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen } from '@/lib/format';
import type { Cart } from '@/lib/types';

export default function CartScreen() {
  const { token } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);

  const load = useCallback(async () => {
    if (!token) { setCart(null); return; }
    try {
      setCart(await api<Cart>('/cart', { auth: token }));
    } catch {
      setCart(null);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function update(id: number, quantity: number) {
    await api(`/cart/items/${id}`, { method: 'PATCH', body: jsonBody({ quantity }), auth: token });
    load();
  }
  async function remove(id: number) {
    await api(`/cart/items/${id}`, { method: 'DELETE', auth: token });
    load();
  }

  if (!token) {
    return (
      <View style={styles.center}>
        <Text>ログインが必要です。</Text>
        <Link href="/login" style={{ color: '#2563eb', marginTop: 8 }}>ログインへ</Link>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={cart?.items ?? []}
        keyExtractor={(i) => String(i.id)}
        ListHeaderComponent={<Text style={styles.title}>カート</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>{item.name}</Text>
              <Text style={{ opacity: 0.6 }}>{yen(item.unit_price_cents)} × </Text>
            </View>
            <TextInput
              defaultValue={String(item.quantity)}
              keyboardType="number-pad"
              onEndEditing={(e) => update(item.id, Number(e.nativeEvent.text) || 1)}
              style={styles.qty}
            />
            <Text style={{ width: 80, textAlign: 'right' }}>{yen(item.line_total_cents)}</Text>
            <Pressable onPress={() => remove(item.id)}><Text style={{ color: '#dc2626', marginLeft: 8 }}>削除</Text></Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={{ padding: 16, opacity: 0.5 }}>カートは空です</Text>}
        ListFooterComponent={
          cart && cart.items.length > 0 ? (
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ opacity: 0.6 }}>小計</Text>
                <Text style={{ fontWeight: 'bold', fontSize: 18 }}>{yen(cart.subtotal_cents)}</Text>
              </View>
              <Link href="/checkout" asChild>
                <Pressable style={styles.cta}><Text style={{ color: '#fff' }}>注文へ進む</Text></Pressable>
              </Link>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { padding: 16, fontSize: 22, fontWeight: 'bold' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 6, backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 4, borderRadius: 8 },
  qty: { width: 48, borderWidth: 1, borderColor: '#ddd', borderRadius: 4, padding: 4, textAlign: 'center' },
  cta: { marginTop: 12, backgroundColor: '#111', padding: 12, borderRadius: 8, alignItems: 'center' },
});
