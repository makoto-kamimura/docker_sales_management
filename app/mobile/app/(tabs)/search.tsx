import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, Switch } from 'react-native';
import { Link } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { api } from '@/lib/api';
import { yen } from '@/lib/format';
import type { Product } from '@/lib/types';

export default function SearchScreen() {
  const [q, setQ] = useState('');
  const [semantic, setSemantic] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const path = semantic
        ? `/products/search?q=${encodeURIComponent(q)}`
        : `/products?q=${encodeURIComponent(q)}`;
      setResults(await api<Product[]>(path));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={{ padding: 12, gap: 8 }}>
        <TextInput
          placeholder="例: 浅煎り、香りが華やか"
          value={q}
          onChangeText={setQ}
          onSubmitEditing={run}
          style={styles.input}
          returnKeyType="search"
        />
        <View style={styles.row}>
          <Text>セマンティック検索 (AI)</Text>
          <Switch value={semantic} onValueChange={setSemantic} />
          <Pressable onPress={run} style={styles.button}>
            <Text style={{ color: '#fff' }}>{busy ? '検索中…' : '検索'}</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Link href={{ pathname: '/products/[id]', params: { id: String(item.id) } }} asChild>
            <Pressable style={styles.card}>
              <Text style={{ fontWeight: '600' }}>{item.name}</Text>
              <Text style={{ opacity: 0.6, fontSize: 12 }}>{item.tags.join(', ')}</Text>
              <Text style={{ marginTop: 4, fontWeight: '700' }}>{yen(item.price_cents)}</Text>
            </Pressable>
          </Link>
        )}
        ListEmptyComponent={
          <Text style={{ padding: 16, opacity: 0.5 }}>
            {busy ? '検索中…' : 'キーワードを入力して検索してください'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: { marginLeft: 'auto', backgroundColor: '#111', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  card: { marginHorizontal: 12, marginVertical: 4, padding: 12, borderRadius: 8, backgroundColor: '#fff' },
});
