import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen } from '@/lib/format';
import type { Subscription } from '@/lib/types';

export default function SubscriptionsScreen() {
  const { token } = useAuth();
  const [subs, setSubs] = useState<Subscription[] | null>(null);

  const load = useCallback(async () => {
    if (!token) { setSubs(null); return; }
    try {
      setSubs(await api<Subscription[]>('/subscriptions', { auth: token }));
    } catch {
      setSubs([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function patch(id: number, action_type: string) {
    await api(`/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify({ action_type }), auth: token });
    load();
  }
  async function skip(id: number) {
    await api(`/subscriptions/${id}/skip`, { method: 'POST', auth: token });
    load();
  }
  async function cancel(id: number) {
    await api(`/subscriptions/${id}`, { method: 'DELETE', auth: token });
    load();
  }

  if (!token) return <View style={styles.center}><Text>ログインが必要です。</Text></View>;

  return (
    <FlatList
      data={subs ?? []}
      keyExtractor={(s) => String(s.id)}
      ListHeaderComponent={<Text style={styles.title}>サブスク</Text>}
      ListEmptyComponent={<Text style={{ padding: 16, opacity: 0.5 }}>購読中のサブスクはありません</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={{ fontWeight: '600' }}>{item.product.name}</Text>
          <Text style={{ opacity: 0.6, fontSize: 12 }}>{item.plan.name} · 次回 {item.next_delivery_on} · {item.status}</Text>
          <Text style={{ fontWeight: 'bold', marginTop: 4 }}>{yen(item.product.price_cents)}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {item.status === 'active' && <Pressable onPress={() => patch(item.id, 'pause')} style={styles.btn}><Text>一時停止</Text></Pressable>}
            {item.status === 'paused' && <Pressable onPress={() => patch(item.id, 'resume')} style={styles.btn}><Text>再開</Text></Pressable>}
            {item.status !== 'cancelled' && <Pressable onPress={() => skip(item.id)} style={styles.btn}><Text>次回スキップ</Text></Pressable>}
            {item.status !== 'cancelled' && <Pressable onPress={() => cancel(item.id)} style={[styles.btn, { borderColor: '#dc2626' }]}><Text style={{ color: '#dc2626' }}>解約</Text></Pressable>}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { padding: 16, fontSize: 22, fontWeight: 'bold' },
  card: { marginHorizontal: 12, marginVertical: 4, padding: 12, borderRadius: 8, backgroundColor: '#fff' },
  btn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
});
