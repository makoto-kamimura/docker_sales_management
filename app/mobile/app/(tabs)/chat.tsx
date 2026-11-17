import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text as RNText, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { MarkdownText } from '@/components/MarkdownText';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useStorefront } from '@/lib/storefront';
import {
  type ConciergeMessage, type ConciergeSession, type PendingOrder,
  ACCEPT_ORDER_TEXT, REVISE_ORDER_TEXT,
  ctaLink, customOrderStarter, fetchMessages, postMessage, readPendingOrder, startConversation, submitCustomOrder,
  suggestions, useConciergeSettings, writePendingOrder,
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
  // オーダーメイドの画面の「AIコンシェルジュを通してオーダーする」から来たとき (n は押すたびに変わる)
  const params = useLocalSearchParams<{ start?: string; product_name?: string; n?: string }>();
  const handledStart = useRef<string | null>(null);

  const [session, setSession] = useState<ConciergeSession | null>(null);
  const [msgs, setMsgs] = useState<ConciergeMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  // オーダーメイドの依頼 (確認カードの「はい」)
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ConciergeMessage>>(null);

  // ログイン・ログアウトで持ち主が変わったら、新しい会話にする
  // ゲストのときに「はい」を押した下書きがあれば、ログイン後にもう一度確かめる
  useEffect(() => {
    setSession(null);
    setMsgs([]);
    setFailure(null);
    setOrderError(null);
    let cancelled = false;
    if (owner === 'guest') setPendingOrder(null);
    else readPendingOrder().then((p) => { if (!cancelled) setPendingOrder(p); });
    return () => { cancelled = true; };
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
    setOrderError(null);
  }

  // 「AIコンシェルジュを通してオーダーする」から来たら、相談の最初の発話を 1 回だけ送る
  useEffect(() => {
    if (!settings?.enabled || busy || params.start !== 'custom_order' || !params.n || handledStart.current === params.n) return;
    handledStart.current = params.n;
    send(customOrderStarter(params.product_name));
    router.setParams({ start: undefined, product_name: undefined, n: undefined });
  });

  // 確認カードの「はい」。会員はそのまま依頼し、ゲストは下書きを覚えてログインへ
  async function acceptOrder(m: ConciergeMessage) {
    if (typeof m.id !== 'number' || !m.order_draft || !session || ordering) return;
    if (!user) {
      if (!session.guest_token) return;
      await writePendingOrder({
        conversation_id: session.id, guest_token: session.guest_token, message_id: m.id,
        title: m.order_draft.title, markdown: m.order_draft.markdown,
      });
      router.push('/login');
      return;
    }
    setOrdering(true);
    setOrderError(null);
    try {
      const res = await submitCustomOrder(session.id, m.id, token);
      setMsgs((list) => [
        ...list.map((x) => (x.id === m.id && x.order_draft
          ? { ...x, order_draft: { ...x.order_draft, service_request_id: res.service_request.id } }
          : x)),
        { id: `local-${Date.now()}`, role: 'user', content: ACCEPT_ORDER_TEXT },
        res.message,
      ]);
    } catch (e) {
      setOrderError(e instanceof Error && e.message ? e.message : '依頼できませんでした。');
    } finally {
      setOrdering(false);
      scrollToEnd();
    }
  }

  // ログイン後に、ゲストのときの下書きで依頼する。会話は本人のものになるので、そのまま続ける
  async function confirmPendingOrder() {
    if (!pendingOrder || !token || ordering) return;
    setOrdering(true);
    setOrderError(null);
    try {
      const res = await submitCustomOrder(pendingOrder.conversation_id, pendingOrder.message_id, token, pendingOrder.guest_token);
      await writePendingOrder(null);
      setPendingOrder(null);
      const next: ConciergeSession = { owner, id: res.conversation_id, guest_token: null };
      setSession(next);
      try {
        setMsgs(await fetchMessages(next, token));
      } catch {
        setMsgs((list) => [...list, res.message]);
      }
    } catch (e) {
      // 依頼済み・会話が見つからないときは、覚えておいた下書きを捨てる
      if (e instanceof ApiError && (e.status === 404 || e.code === 'already_ordered')) {
        await writePendingOrder(null);
        setPendingOrder(null);
      }
      setOrderError(e instanceof Error && e.message ? e.message : '依頼できませんでした。');
    } finally {
      setOrdering(false);
      scrollToEnd();
    }
  }

  async function cancelPendingOrder() {
    await writePendingOrder(null);
    setPendingOrder(null);
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
  const textColor = dark ? '#f7f7f5' : '#1b1b19';
  // ボタンを出すのは最新の下書きだけ (前のものは修正済み)
  const latestDraftId = [...msgs].reverse().find((m) => m.order_draft)?.id;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={pendingOrder ? null : (
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
        )}
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
              {item.order_draft ? (
                <DraftCard title={item.order_draft.title} markdown={item.order_draft.markdown} dark={dark}>
                  {item.order_draft.service_request_id ? (
                    <Pressable onPress={() => router.push('/requests')} accessibilityRole="link">
                      <RNText style={[styles.draftNote, { color: textColor }]}>
                        依頼済み（#{item.order_draft.service_request_id}）  <RNText style={styles.ctaText}>問い合わせ・依頼を見る →</RNText>
                      </RNText>
                    </Pressable>
                  ) : item.id !== latestDraftId ? (
                    <RNText style={[styles.draftNote, { color: textColor, opacity: 0.6 }]}>この内容は修正されています。</RNText>
                  ) : (
                    <>
                      <RNText style={[styles.draftQuestion, { color: textColor }]}>この内容でオーダーしますか？</RNText>
                      <View style={styles.draftActions}>
                        <Pressable onPress={() => void acceptOrder(item)} disabled={busy || ordering}
                                   style={[styles.accept, (busy || ordering) && { opacity: 0.5 }]}>
                          <RNText style={styles.acceptText}>{user ? 'はい、オーダーする' : 'ログインしてオーダーする'}</RNText>
                        </Pressable>
                        <Pressable onPress={() => send(REVISE_ORDER_TEXT)} disabled={busy || ordering}
                                   style={[styles.revise, { borderColor: line }, (busy || ordering) && { opacity: 0.5 }]}>
                          <RNText style={[styles.reviseText, { color: textColor }]}>修正する</RNText>
                        </Pressable>
                      </View>
                      {!user ? (
                        <RNText style={[styles.draftHint, { color: textColor }]}>
                          依頼には会員登録（ログイン）が必要です。ログイン後に、この内容で依頼できます。
                        </RNText>
                      ) : null}
                    </>
                  )}
                </DraftCard>
              ) : null}
            </View>
          );
        }}
        ListFooterComponent={
          <View style={{ backgroundColor: 'transparent' }}>
            {pendingOrder ? (
              <View style={{ backgroundColor: 'transparent', gap: 8 }}>
                <View style={[styles.bubble, styles.theirs, bubble.assistant, { alignSelf: 'flex-start' }]}>
                  <RNText style={[styles.bubbleText, { color: textColor }]}>ログイン前にまとめたオーダーの内容です。この内容でオーダーしますか？</RNText>
                </View>
                <DraftCard title={pendingOrder.title} markdown={pendingOrder.markdown} dark={dark}>
                  <View style={styles.draftActions}>
                    <Pressable onPress={() => void confirmPendingOrder()} disabled={ordering}
                               style={[styles.accept, ordering && { opacity: 0.5 }]}>
                      <RNText style={styles.acceptText}>この内容でオーダーする</RNText>
                    </Pressable>
                    <Pressable onPress={() => void cancelPendingOrder()} disabled={ordering} style={[styles.revise, { borderColor: line }]}>
                      <RNText style={[styles.reviseText, { color: textColor }]}>やめる</RNText>
                    </Pressable>
                  </View>
                </DraftCard>
              </View>
            ) : null}
            {orderError && !ordering ? (
              <View style={styles.failure} accessibilityRole="alert">
                <RNText style={styles.failureText}>{orderError}</RNText>
              </View>
            ) : null}
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

/** AIコンシェルジュが提示したオーダーメイドの下書き (制作依頼書) と、その下の操作 */
function DraftCard({ title, markdown, dark, children }: { title: string; markdown: string; dark: boolean; children?: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const color = dark ? '#f7f7f5' : '#1b1b19';
  return (
    <View style={[styles.draft, { backgroundColor: dark ? '#1b1b19' : '#fff' }]}>
      <View style={styles.draftHead}>
        <RNText style={styles.draftEyebrow}>制作依頼書</RNText>
        <RNText style={[styles.draftTitle, { color }]}>{title}</RNText>
      </View>
      <View style={[styles.draftBody, !expanded && styles.draftCollapsed]}>
        <MarkdownText color={color} fontSize={13}>{markdown}</MarkdownText>
      </View>
      <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={6} style={styles.draftToggle} accessibilityState={{ expanded }}>
        <RNText style={styles.ctaText}>{expanded ? 'たたむ' : '全文を見る'}</RNText>
      </Pressable>
      {children ? <View style={[styles.draftFooter, { backgroundColor: 'transparent' }]}>{children}</View> : null}
    </View>
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
  draft: { marginTop: 8, width: '92%', borderWidth: 1, borderColor: ACCENT, borderRadius: 16, overflow: 'hidden' },
  draftHead: { paddingHorizontal: 13, paddingVertical: 8, backgroundColor: 'rgba(255,87,34,0.08)' },
  draftEyebrow: { color: ACCENT, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  draftTitle: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  draftBody: { paddingHorizontal: 13, paddingTop: 8 },
  draftCollapsed: { maxHeight: 200, overflow: 'hidden' },
  draftToggle: { alignSelf: 'center', paddingVertical: 8 },
  draftFooter: { paddingHorizontal: 13, paddingBottom: 12, gap: 8 },
  draftQuestion: { fontSize: 13, fontWeight: '700' },
  draftActions: { flexDirection: 'row', gap: 8 },
  draftNote: { fontSize: 12 },
  draftHint: { fontSize: 10, opacity: 0.6, lineHeight: 15 },
  accept: { flex: 1, backgroundColor: ACCENT, borderRadius: 999, paddingVertical: 9, alignItems: 'center' },
  acceptText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  revise: { borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center' },
  reviseText: { fontSize: 13, fontWeight: '600' },
});
