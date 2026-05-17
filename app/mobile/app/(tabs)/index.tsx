import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

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
            <Text style={styles.title}>docker_ruby ストア</Text>
            <Text style={{ opacity: 0.6, marginTop: 4 }}>新着商品</Text>
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
  title: { fontSize: 22, fontWeight: 'bold' },
  card: { marginHorizontal: 16, marginVertical: 6, padding: 12, borderRadius: 10, backgroundColor: '#fff', elevation: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSub: { opacity: 0.5, fontSize: 12 },
  price: { marginTop: 6, fontSize: 18, fontWeight: 'bold' },
  tag: { marginTop: 4, alignSelf: 'flex-start', fontSize: 11, color: '#047857', backgroundColor: '#d1fae5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
});
