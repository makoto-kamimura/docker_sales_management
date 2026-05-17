import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen } from '@/lib/format';
import type { Order } from '@/lib/types';

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [o, setO] = useState<Order | null>(null);

  useEffect(() => {
    (async () => {
      try { setO(await api<Order>(`/orders/${id}`, { auth: token })); } catch { /* ignore */ }
    })();
  }, [id, token]);

  if (!o) return <Text style={{ padding: 16 }}>読み込み中…</Text>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>注文 #{o.id}</Text>
      <Text style={{ opacity: 0.6 }}>{o.status} · {new Date(o.placed_at).toLocaleString('ja-JP')}</Text>
      <View style={{ marginTop: 12 }}>
        {o.items?.map((i) => (
          <View key={i.product_id} style={styles.row}>
            <Text style={{ flex: 1 }}>{i.name} × {i.quantity}</Text>
            <Text>{yen(i.line_total_cents)}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.row, { borderTopWidth: 1, borderColor: '#eee', paddingTop: 8, marginTop: 8 }]}>
        <Text style={{ flex: 1, fontWeight: 'bold' }}>合計</Text>
        <Text style={{ fontWeight: 'bold' }}>{yen(o.total_cents)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: 'bold' },
  row: { flexDirection: 'row', paddingVertical: 4 },
});
