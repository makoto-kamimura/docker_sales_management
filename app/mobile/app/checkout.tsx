import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { api, jsonBody } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen } from '@/lib/format';
import type { Address, Cart, Order } from '@/lib/types';

export default function CheckoutScreen() {
  const { token } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        const [c, a] = await Promise.all([
          api<Cart>('/cart', { auth: token }),
          api<Address[]>('/me/addresses', { auth: token }),
        ]);
        setCart(c); setAddresses(a); setAddressId(a[0]?.id ?? null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'エラー');
      }
    })();
  }, [token]);

  async function place() {
    if (!addressId) { setErr('住所が未登録です'); return; }
    setBusy(true); setErr(null);
    try {
      const o = await api<Order>('/orders', { method: 'POST', body: jsonBody({ address_id: addressId }), auth: token });
      router.replace({ pathname: '/orders/[id]', params: { id: String(o.id) } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'エラー');
    } finally {
      setBusy(false);
    }
  }

  if (!token) return <Text style={{ padding: 16 }}>ログインが必要です。</Text>;
  if (!cart) return <Text style={{ padding: 16 }}>読み込み中…</Text>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>ご注文確認</Text>

      <Text style={styles.h2}>お届け先</Text>
      {addresses.length === 0 ? (
        <Text>先にアプリのアカウント画面で住所を登録してください。</Text>
      ) : (
        addresses.map((a) => (
          <Pressable key={a.id} onPress={() => setAddressId(a.id)} style={[styles.address, a.id === addressId && styles.selected]}>
            <Text style={{ fontWeight: '600' }}>{a.recipient}</Text>
            <Text style={{ fontSize: 12, opacity: 0.7 }}>〒{a.postal_code} {a.prefecture}{a.city}{a.line1}</Text>
          </Pressable>
        ))
      )}

      <Text style={styles.h2}>明細</Text>
      {cart.items.map((i) => (
        <View key={i.id} style={styles.row}>
          <Text style={{ flex: 1 }}>{i.name} × {i.quantity}</Text>
          <Text>{yen(i.line_total_cents)}</Text>
        </View>
      ))}
      <View style={[styles.row, { marginTop: 12 }]}>
        <Text style={{ flex: 1, fontWeight: 'bold' }}>小計</Text>
        <Text style={{ fontWeight: 'bold' }}>{yen(cart.subtotal_cents)}</Text>
      </View>
      <Text style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>※ 税/送料はサーバー側で計算</Text>

      {err && <Text style={{ color: '#dc2626', marginTop: 8 }}>{err}</Text>}
      <Pressable onPress={place} disabled={busy || cart.items.length === 0 || addresses.length === 0}
                 style={[styles.cta, (busy || cart.items.length === 0 || addresses.length === 0) && { opacity: 0.5 }]}>
        <Text style={{ color: '#fff' }}>注文を確定する</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: 'bold' },
  h2: { marginTop: 16, fontWeight: 'bold' },
  address: { padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, marginTop: 6 },
  selected: { borderColor: '#111', backgroundColor: '#f5f5f5' },
  row: { flexDirection: 'row', paddingVertical: 4 },
  cta: { marginTop: 16, backgroundColor: '#111', padding: 14, borderRadius: 8, alignItems: 'center' },
});
