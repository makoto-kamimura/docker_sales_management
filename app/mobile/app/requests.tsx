import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen, fmtDate } from '@/lib/format';
import { REQUEST_KIND_LABEL as KIND_LABEL, REQUEST_STATUS_LABEL as STATUS_LABEL } from '@/lib/orderStatus';
import type { ServiceRequest } from '@/lib/types';

const ACCENT = '#ff5722';

export default function RequestsScreen() {
  const { token } = useAuth();
  const [reqs, setReqs] = useState<ServiceRequest[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setReqs([]); return; }
    try {
      setReqs(await api<ServiceRequest[]>('/service_requests', { auth: token }));
    } catch {
      setReqs([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (!token) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '問い合わせ・依頼' }} />
        <Text style={{ opacity: 0.6 }}>ログインが必要です。</Text>
        <Link href="/login" style={{ color: ACCENT, marginTop: 8 }}>ログイン →</Link>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '問い合わせ・依頼' }} />
      <FlatList
        data={reqs ?? []}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListHeaderComponent={
          <View style={styles.actions}>
            <Link href={{ pathname: '/service-request', params: { kind: 'inquiry' } }} style={styles.actionBtn}>問い合わせる</Link>
            <Link href={{ pathname: '/service-request', params: { kind: 'custom' } }} style={styles.actionBtn}>オーダーメイド</Link>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.kind}>{KIND_LABEL[item.kind] ?? item.kind}</Text>
              <Text style={styles.status}>{STATUS_LABEL[item.status] ?? item.status}</Text>
            </View>
            {!!item.subject && <Text style={styles.product}>{item.subject}</Text>}
            <Text style={styles.body} numberOfLines={3}>{item.body}</Text>
            <Text style={styles.meta}>
              {item.order_id ? `注文 #${item.order_id}  ` : ''}
              {item.product ? `メニュー: ${item.product.name}  ` : ''}
              {item.preferred_at ? `希望納期: ${fmtDate(item.preferred_at)}  ` : ''}
              {item.budget_cents != null ? `予算: ${yen(item.budget_cents)}` : ''}
            </Text>
            {!!item.reply && (
              <View style={styles.reply}>
                <Text style={styles.replyLabel}>ショップからの回答</Text>
                <Text style={styles.body}>{item.reply}</Text>
              </View>
            )}
            <Text style={styles.date}>{fmtDate(item.created_at)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ opacity: 0.5, textAlign: 'center', marginTop: 24 }}>
            {reqs === null ? '読み込み中…' : 'まだ問い合わせはありません'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  actionBtn: { color: '#fff', backgroundColor: ACCENT, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, overflow: 'hidden', fontWeight: '600' },
  card: { padding: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dededa' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kind: { fontSize: 11, fontWeight: '700', color: ACCENT, letterSpacing: 1 },
  status: { fontSize: 12, fontWeight: '600', color: '#1b1b19' },
  product: { marginTop: 6, fontWeight: '600', color: '#1b1b19' },
  body: { marginTop: 4, color: '#2f2f2c' },
  meta: { marginTop: 6, fontSize: 12, color: '#686863' },
  date: { marginTop: 4, fontSize: 11, color: '#8c8c86' },
  reply: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: '#f7f7f5', borderWidth: 1, borderColor: '#ededea' },
  replyLabel: { fontSize: 11, fontWeight: '700', color: '#686863' },
});
