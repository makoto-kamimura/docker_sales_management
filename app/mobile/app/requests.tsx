import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';

import { MarkdownText } from '@/components/MarkdownText';
import { Text, View } from '@/components/Themed';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen, fmtDate } from '@/lib/format';
import { REQUEST_KIND_LABEL as KIND_LABEL, REQUEST_STATUS_LABEL as STATUS_LABEL } from '@/lib/orderStatus';
import type { ServiceRequest } from '@/lib/types';
import { useStorefront } from '@/lib/storefront';

const ACCENT = '#ff5722';

export default function RequestsScreen() {
  const { token } = useAuth();
  const [reqs, setReqs] = useState<ServiceRequest[] | null>(null);
  const storefront = useStorefront();
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
            {storefront?.custom_orders ? (
              <Link href={{ pathname: '/service-request', params: { kind: 'custom' } }} style={styles.actionBtn}>オーダーメイド</Link>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.kind}>{KIND_LABEL[item.kind] ?? item.kind}</Text>
              <Text style={styles.status}>{STATUS_LABEL[item.status] ?? item.status}</Text>
            </View>
            {item.from_concierge ? <Text style={styles.viaAi}>AIコンシェルジュ経由</Text> : null}
            {!!item.subject && <Text style={styles.product}>{item.subject}</Text>}
            <RequestBody body={item.body} />
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

/** 本文は Markdown として整形して出す (AIコンシェルジュ経由の依頼は制作依頼書)。長いものは折りたたむ */
function RequestBody({ body }: { body: string }) {
  const long = body.length > 240 || body.split('\n').length > 6;
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ backgroundColor: 'transparent' }}>
      <View style={[styles.bodyBox, long && !expanded && styles.bodyCollapsed]}>
        <MarkdownText color="#2f2f2c">{body}</MarkdownText>
      </View>
      {long ? (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={6} accessibilityState={{ expanded }}>
          <Text style={styles.more}>{expanded ? 'たたむ' : '全文を見る'}</Text>
        </Pressable>
      ) : null}
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
  bodyBox: { marginTop: 4 },
  bodyCollapsed: { maxHeight: 130, overflow: 'hidden' },
  more: { marginTop: 4, fontSize: 12, fontWeight: '700', color: ACCENT },
  viaAi: { marginTop: 4, alignSelf: 'flex-start', fontSize: 10, fontWeight: '700', color: ACCENT, backgroundColor: 'rgba(255,87,34,0.08)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  meta: { marginTop: 6, fontSize: 12, color: '#686863' },
  date: { marginTop: 4, fontSize: 11, color: '#8c8c86' },
  reply: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: '#f7f7f5', borderWidth: 1, borderColor: '#ededea' },
  replyLabel: { fontSize: 11, fontWeight: '700', color: '#686863' },
});
