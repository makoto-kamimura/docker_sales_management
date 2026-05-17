import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen } from '@/lib/format';
import type { Order } from '@/lib/types';

export default function AccountScreen() {
  const { user, token, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    try { setOrders(await api<Order[]>('/orders', { auth: token })); } catch { /* ignore */ }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={{ marginBottom: 8 }}>ログインしてください。</Text>
        <Link href="/login" style={{ color: '#2563eb' }}>ログイン</Link>
        <Text style={{ marginTop: 4 }}>または</Text>
        <Link href="/register" style={{ color: '#2563eb' }}>会員登録</Link>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16 }}>
        <Text style={styles.title}>{user.name}</Text>
        <Text style={{ opacity: 0.6 }}>{user.email}</Text>
        <Pressable onPress={logout} style={styles.logout}><Text>ログアウト</Text></Pressable>
      </View>
      <Text style={{ paddingHorizontal: 16, fontWeight: 'bold' }}>注文履歴</Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        ListEmptyComponent={<Text style={{ padding: 16, opacity: 0.5 }}>まだ注文はありません</Text>}
        renderItem={({ item }) => (
          <Link href={{ pathname: '/orders/[id]', params: { id: String(item.id) } }} asChild>
            <Pressable style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>#{item.id}</Text>
                <Text style={{ opacity: 0.6, fontSize: 12 }}>{item.status} · {new Date(item.placed_at).toLocaleString('ja-JP')}</Text>
              </View>
              <Text style={{ fontWeight: 'bold' }}>{yen(item.total_cents)}</Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: 'bold' },
  logout: { marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 4, borderRadius: 8 },
});
