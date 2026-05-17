import { useCallback, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import { api, jsonBody } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Msg = { id: number | string; role: 'user' | 'assistant'; content: string; cta?: string | null };

export default function ChatScreen() {
  const { token } = useAuth();
  const [convoId, setConvoId] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  const ensureConvo = useCallback(async () => {
    if (convoId) return convoId;
    const c = await api<{ id: number }>('/ai_concierge/conversations', { method: 'POST', auth: token });
    setConvoId(c.id);
    return c.id;
  }, [convoId, token]);

  async function send() {
    if (!input.trim() || busy) return;
    const text = input;
    setInput('');
    setMsgs((m) => [...m, { id: `local-${Date.now()}`, role: 'user', content: text }]);
    setBusy(true);
    try {
      const cid = await ensureConvo();
      const reply = await api<Msg>(`/ai_concierge/conversations/${cid}/messages`, {
        method: 'POST', body: jsonBody({ content: text }), auth: token,
      });
      setMsgs((m) => [...m, reply]);
    } catch (e) {
      const m = e instanceof Error ? e.message : 'エラー';
      setMsgs((arr) => [...arr, { id: `err-${Date.now()}`, role: 'assistant', content: `(${m})` }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 12, gap: 6 }}
        ListEmptyComponent={<Text style={{ opacity: 0.5 }}>商品の質問や注文状況、お気軽にどうぞ。</Text>}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.user : styles.assistant]}>
            <Text style={item.role === 'user' ? { color: '#fff' } : undefined}>{item.content}</Text>
            {item.cta ? <Text style={{ opacity: 0.6, fontSize: 11, marginTop: 4 }}>→ {item.cta}</Text> : null}
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          placeholder="メッセージ"
          value={input}
          onChangeText={setInput}
          style={styles.input}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable onPress={send} disabled={busy} style={styles.send}>
          <Text style={{ color: '#fff' }}>送信</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { padding: 10, borderRadius: 14, maxWidth: '85%' },
  user: { alignSelf: 'flex-end', backgroundColor: '#111' },
  assistant: { alignSelf: 'flex-start', backgroundColor: '#eee' },
  inputRow: { flexDirection: 'row', padding: 8, borderTopWidth: 1, borderColor: '#eee', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8 },
  send: { backgroundColor: '#111', paddingHorizontal: 14, justifyContent: 'center', borderRadius: 8 },
});
