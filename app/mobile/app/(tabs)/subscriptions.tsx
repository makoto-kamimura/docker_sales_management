import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen } from '@/lib/format';
import { openStripe } from '@/lib/payments';
import type { Subscription } from '@/lib/types';

// 定期便。カード (Stripe) で、お届けの間隔ごとに自動で決済する。支払いカードの変更は Stripe の画面で行う
export default function SubscriptionsScreen() {
  const { token } = useAuth();
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  async function run(fn: () => Promise<unknown>) {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'エラー');
    }
    load();
  }
  const patch = (id: number, action_type: string) =>
    run(() => api(`/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify({ action_type }), auth: token }));
  const skip = (id: number) => run(() => api(`/subscriptions/${id}/skip`, { method: 'POST', auth: token }));
  const cancel = (id: number) => run(() => api(`/subscriptions/${id}`, { method: 'DELETE', auth: token }));
  const openPortal = () => run(() => openStripe('/subscriptions/portal_session', token));

  if (!token) return <View style={styles.center}><Text>ログインが必要です。</Text></View>;

  const hasCardSubscription = subs?.some((s) => s.card && s.status !== 'cancelled' && s.status !== 'incomplete');

  return (
    <FlatList
      data={subs ?? []}
      keyExtractor={(s) => String(s.id)}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>サブスク</Text>
          {hasCardSubscription && <Pressable onPress={openPortal} style={styles.btn}><Text>支払いカードの変更</Text></Pressable>}
          {err && <Text style={{ color: '#dc2626', width: '100%' }}>{err}</Text>}
        </View>
      }
      ListEmptyComponent={<Text style={{ padding: 16, opacity: 0.5 }}>購読中のサブスクはありません</Text>}
      renderItem={({ item }) => {
        const open = item.status !== 'cancelled' && item.status !== 'incomplete';
        return (
          <View style={styles.card}>
            <Text style={{ fontWeight: '600' }}>{item.product.name} × {item.quantity}</Text>
            <Text style={{ opacity: 0.6, fontSize: 12 }}>
              {item.plan.name}{open ? ` · 次回 ${item.next_delivery_on}` : ''} · {item.status_label}
            </Text>
            <Text style={{ fontWeight: 'bold', marginTop: 4 }}>{yen(item.charge_cents)} <Text style={{ fontSize: 11, opacity: 0.5 }}>/ 回 (税・送料込み)</Text></Text>
            {item.status === 'past_due' && (
              <Text style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>カードの決済ができませんでした。「支払いカードの変更」からカードを更新してください。</Text>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {item.status === 'active' && <Pressable onPress={() => patch(item.id, 'pause')} style={styles.btn}><Text>一時停止</Text></Pressable>}
              {item.status === 'paused' && <Pressable onPress={() => patch(item.id, 'resume')} style={styles.btn}><Text>再開</Text></Pressable>}
              {open && <Pressable onPress={() => skip(item.id)} style={styles.btn}><Text>次回スキップ</Text></Pressable>}
              {item.status !== 'cancelled' && (
                <Pressable onPress={() => cancel(item.id)} style={[styles.btn, { borderColor: '#dc2626' }]}>
                  <Text style={{ color: '#dc2626' }}>{item.status === 'incomplete' ? '申し込みを取り消す' : '解約'}</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold' },
  card: { marginHorizontal: 12, marginVertical: 4, padding: 12, borderRadius: 8, backgroundColor: '#fff' },
  btn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
});
