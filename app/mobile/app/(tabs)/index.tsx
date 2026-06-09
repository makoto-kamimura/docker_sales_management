import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

const ACCENT = '#ff5722';

import { Text, View } from '@/components/Themed';
import { api } from '@/lib/api';
import { yen } from '@/lib/format';
import type { Product } from '@/lib/types';

export default function HomeScreen() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setProducts(await api<Product[]>('/products'));
    } catch {
      setProducts([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.container}>
      <FlatList
        data={products ?? []}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListHeaderComponent={
          <View style={{ padding: 16 }}>
            <Text style={styles.brand}>ROUTE & ROAST</Text>
            <Text style={styles.tagline}>RIDERS CAFE · COFFEE · PARTS · MAINTENANCE · SYSTEM</Text>
            <View style={styles.actions}>
              <Link href={{ pathname: '/service-request', params: { kind: 'maintenance' } }} style={styles.actionBtn}>整備を予約</Link>
              <Link href={{ pathname: '/service-request', params: { kind: 'system' } }} style={styles.actionBtn}>開発を依頼</Link>
              <Link href="/requests" style={styles.actionBtnOutline}>依頼状況</Link>
            </View>
            <Text style={styles.section}>新着商品</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/products/[id]', params: { id: String(item.id) } }} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSub}>{item.sku}</Text>
              <Text style={styles.price}>{yen(item.price_cents)}</Text>
              {item.is_subscribable && <Text style={styles.tag}>サブスク対応</Text>}
            </Pressable>
          </Link>
        )}
        ListEmptyComponent={<Text style={{ padding: 16, opacity: 0.5 }}>読み込み中…</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  brand: { fontSize: 24, fontWeight: 'bold', letterSpacing: 0.5, color: '#1b1b19' },
  tagline: { marginTop: 4, fontSize: 10, letterSpacing: 1, color: '#8c8c86' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  actionBtn: { color: '#fff', backgroundColor: ACCENT, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, overflow: 'hidden', fontSize: 13, fontWeight: '600' },
  actionBtnOutline: { color: '#1b1b19', borderWidth: 1, borderColor: '#dededa', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, overflow: 'hidden', fontSize: 13, fontWeight: '600' },
  section: { marginTop: 20, fontSize: 13, fontWeight: '700', color: '#1b1b19' },
  card: { marginHorizontal: 16, marginVertical: 6, padding: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dededa' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1b1b19' },
  cardSub: { opacity: 0.5, fontSize: 12 },
  price: { marginTop: 6, fontSize: 18, fontWeight: 'bold', color: '#1b1b19' },
  tag: { marginTop: 6, alignSelf: 'flex-start', fontSize: 11, color: '#fff', backgroundColor: '#ff5722', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
});
