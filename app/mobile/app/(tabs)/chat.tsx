import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text as RNText, TextInput } from 'react-native';
import { router } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useStorefront } from '@/lib/storefront';
import {
  type ConciergeMessage, type ConciergeSession,
  ctaLink, postMessage, startConversation, suggestions, useConciergeSettings,
} from '@/lib/concierge';

const ACCENT = '#ff5722';

/** 送れなかった発話。文言を出し、同じ内容を送り直せるようにする */
type Failure = { text: string; message: string };

export default function ChatScreen() {
  const { user, token } = useAuth();
  const settings = useConciergeSettings();
  const storefront = useStorefront();
  const dark = useColorScheme() === 'dark';
  const owner = user ? `user-${user.id}` : 'guest';

  const [session, setSession] = useState<ConciergeSession | null>(null);
  const [msgs, setMsgs] = useState<ConciergeMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const listRef = useRef<FlatList<ConciergeMessage>>(null);

  // ログイン・ログアウトで持ち主が変わったら、新しい会話にする
  // ログイン・ログアウトで持ち主が変わったら、新しい会話にする
  useEffect(() => {
    setSession(null);
    setMsgs([]);
    setFailure(null);
  }, [owner]);

  const scrollToEnd = () => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

  async function deliver(text: string) {
    setBusy(true);
    setFailure(null);
    scrollToEnd();
    try {
      let current = session ?? (await startConversation(owner, token));
      let reply: ConciergeMessage;
      try {
        reply = await postMessage(current, text, token);
      } catch (e) {
        // 会話が見つからない (期限切れなど) ときは、新しい会話で 1 回だけ送り直す
        if (!(e instanceof ApiError && e.status === 404)) throw e;
        current = await startConversation(owner, token);
        reply = await postMessage(current, text, token);
      }
      setSession(current);
      setMsgs((m) => [...m, reply]);
    } catch (e) {
      setFailure({ text, message: e instanceof Error && e.message ? e.message : '送信できませんでした。' });
    } finally {
      setBusy(false);
      scrollToEnd();
    }
  }

  function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    setMsgs((m) => [...m, { id: `local-${Date.now()}`, role: 'user', content: text }]);
    void deliver(text);
  }

  function reset() {
    setSession(null);
    setMsgs([]);
    setFailure(null);
  }

  if (!settings?.enabled) {
    return (
      <View style={styles.center}>
        {settings ? <Text style={styles.muted}>AIコンシェルジュは現在ご利用いただけません。</Text> : <ActivityIndicator color={ACCENT} />}
      </View>
    );
  }

  const bubble = {
    user: { backgroundColor: dark ? '#2f2f2c' : '#141413' },
    assistant: { backgroundColor: dark ? '#1b1b19' : '#fff', borderColor: dark ? '#2f2f2c' : '#dededa', borderWidth: 1 },
  };
  const line = dark ? '#2f2f2c' : '#dededa';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.greeting}>
              {user ? `${user.name} さん、こんにちは。\n` : 'こんにちは。\n'}
              作品探しや、ご注文・お支払いについてのご質問にお答えします。
            </Text>
            {suggestions(!!user, storefront?.custom_orders ?? false).map((s) => (
              <Pressable key={s} onPress={() => send(s)} disabled={busy} style={[styles.chip, { borderColor: line }]}>
                <Text style={styles.chipText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.role === 'user';
          const link = item.cta ? ctaLink(item.cta) : null;
          return (
            <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', backgroundColor: 'transparent' }}>
              <View style={[styles.bubble, mine ? bubble.user : bubble.assistant, mine ? styles.mine : styles.theirs]}>
                <RNText style={[styles.bubbleText, { color: mine || dark ? '#f7f7f5' : '#1b1b19' }]}>{item.content}</RNText>
              </View>
              {link ? (
                <Pressable onPress={() => router.push(link.href)} style={styles.cta} accessibilityRole="link">
                  <RNText style={styles.ctaText}>{link.label} →</RNText>
                </Pressable>
              ) : null}
            </View>
          );
        }}
        ListFooterComponent={
          <View style={{ backgroundColor: 'transparent' }}>
            {busy ? (
              <View style={[styles.bubble, styles.theirs, bubble.assistant, { alignSelf: 'flex-start' }]} accessibilityLabel="応答を作成しています">
                <ActivityIndicator size="small" color={ACCENT} />
              </View>
            ) : null}
            {failure && !busy ? (
              <View style={styles.failure} accessibilityRole="alert">
                <RNText style={styles.failureText}>{failure.message}</RNText>
                <Pressable onPress={() => void deliver(failure.text)} hitSlop={8}>
                  <RNText style={[styles.failureText, styles.retry]}>もう一度送る</RNText>
                </Pressable>
              </View>
            ) : null}
            {msgs.length > 0 && !busy ? (
              <Pressable onPress={reset} hitSlop={8} style={styles.reset}>
                <Text style={styles.muted}>新しい会話を始める</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />
      <View style={[styles.inputRow, { borderColor: line }]}>
        <TextInput
          placeholder="メッセージを入力…"
          placeholderTextColor="#8c8c86"
          value={input}
          onChangeText={setInput}
          maxLength={settings.max_content_length}
          style={[styles.input, { borderColor: line, color: dark ? '#f7f7f5' : '#1b1b19', backgroundColor: dark ? '#1b1b19' : '#fff' }]}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          accessibilityLabel="メッセージ"
        />
        <Pressable onPress={() => send(input)} disabled={busy || !input.trim()} style={[styles.send, (busy || !input.trim()) && { opacity: 0.5 }]}>
          <RNText style={styles.sendText}>送信</RNText>
        </Pressable>
      </View>
      <Text style={styles.note}>AI の回答です。価格・在庫・納期は商品ページと注文詳細でご確認ください。</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontSize: 12, opacity: 0.6 },
  list: { padding: 12, gap: 8, flexGrow: 1 },
  empty: { paddingTop: 24, paddingHorizontal: 12, gap: 10, backgroundColor: 'transparent' },
  greeting: { textAlign: 'center', lineHeight: 22, opacity: 0.8, marginBottom: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  chipText: { fontSize: 13 },
  bubble: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 16, maxWidth: '85%' },
  mine: { borderBottomRightRadius: 5 },
  theirs: { borderBottomLeftRadius: 5 },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  cta: { marginTop: 6, borderWidth: 1, borderColor: ACCENT, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  ctaText: { color: ACCENT, fontSize: 12, fontWeight: '700' },
  failure: { marginTop: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  failureText: { color: '#b91c1c', fontSize: 12, lineHeight: 18 },
  retry: { fontWeight: '700', textDecorationLine: 'underline' },
  reset: { alignSelf: 'center', marginTop: 14 },
  inputRow: { flexDirection: 'row', paddingHorizontal: 10, paddingTop: 8, borderTopWidth: 1, gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, fontSize: 14 },
  send: { backgroundColor: ACCENT, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 999 },
  sendText: { color: '#fff', fontWeight: '700' },
  note: { fontSize: 10, opacity: 0.5, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
});
