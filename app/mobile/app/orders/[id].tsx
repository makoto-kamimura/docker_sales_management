import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { api, fetchAssemblyGuideUrl, fetchDownloadUrl, jsonBody } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, yen } from '@/lib/format';
import { DIGITAL_FLOW, ORDER_FLOW, ORDER_STATUS_LABEL, type OrderStatus } from '@/lib/orderStatus';
import { fetchCardEnabled, openStripe } from '@/lib/payments';
import type { Order, PaymentKind } from '@/lib/types';

const ACCENT = '#ff5722';

export default function OrderDetail() {
  // pay=1: 注文の確定直後に、カードの決済の画面を開く
  const { id, pay } = useLocalSearchParams<{ id: string; pay?: string }>();
  const { token } = useAuth();
  const [o, setO] = useState<Order | null>(null);
  const [dlErr, setDlErr] = useState<string | null>(null);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const autoPaid = useRef(false);

  // 期限付きURLをブラウザで開いてダウンロードする
  async function download(getUrl: () => Promise<string>) {
    setDlErr(null);
    try {
      await Linking.openURL(await getUrl());
    } catch (e) {
      setDlErr(e instanceof Error ? e.message : 'ダウンロードに失敗しました');
    }
  }

  const load = useCallback(async () => {
    try { setO(await api<Order>(`/orders/${id}`, { auth: token })); } catch { /* ignore */ }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  // カードの決済の画面 (Stripe) を開き、閉じたら取り直す。Webhook の反映が少し遅れることがあるので数回取り直す
  const payByCard = useCallback(async (path: string) => {
    setPayErr(null);
    setPaying(true);
    try {
      await openStripe(path, token);
    } catch (e) {
      setPayErr(e instanceof Error ? e.message : '決済の画面を開けませんでした');
    } finally {
      setPaying(false);
    }
    load();
    [2000, 5000].forEach((ms) => setTimeout(load, ms));
  }, [token, load]);

  useEffect(() => {
    if (pay !== '1' || autoPaid.current || !o?.card_payable) return;
    autoPaid.current = true;
    payByCard(`/orders/${o.id}/checkout_session`);
  }, [pay, o, payByCard]);

  if (!o) return <Text style={{ padding: 16 }}>読み込み中…</Text>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>注文 #{o.id}</Text>
      <Text style={{ opacity: 0.6 }}>{o.status_label} · {new Date(o.placed_at).toLocaleString('ja-JP')}</Text>
      {o.card_payable && (
        <View style={styles.tip}>
          <Text style={{ fontSize: 13 }}>お支払いがまだ済んでいません。カードでお支払いいただくと、入金を確認して制作・発送に進みます。</Text>
          <Pressable onPress={() => payByCard(`/orders/${o.id}/checkout_session`)} disabled={paying}
                     style={[styles.download, { marginTop: 8, paddingVertical: 8 }, paying && { opacity: 0.5 }]}>
            <Text style={{ color: '#fff' }}>{paying ? '決済の画面を開いています…' : `${yen(o.total_cents)} をカードで支払う`}</Text>
          </Pressable>
        </View>
      )}
      {payErr && <Text style={{ color: '#dc2626', marginTop: 8 }}>{payErr}</Text>}
      <Progress order={o} />
      <View style={{ marginTop: 12 }}>
        {o.items?.map((i) => (
          <View key={i.product_id} style={{ paddingVertical: 4 }}>
            <View style={styles.row}>
              <Text style={{ flex: 1 }}>{i.name} × {i.quantity}</Text>
              <Text>{yen(i.line_total_cents)}</Text>
            </View>
            {i.is_digital && (o.downloadable ? (
              <View style={styles.downloads}>
                <Pressable onPress={() => download(() => fetchDownloadUrl(i.product_id, token))} style={styles.download}>
                  <Text style={{ color: '#fff', fontSize: 12 }}>⬇ ダウンロード</Text>
                </Pressable>
                {i.has_assembly && (
                  <Pressable onPress={() => download(() => fetchAssemblyGuideUrl(i.product_id, token))} style={[styles.download, styles.guide]}>
                    <Text style={{ color: ACCENT, fontSize: 12 }}>📄 組み立て説明書</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Text style={{ fontSize: 12, opacity: 0.5 }}>お支払い確認後にダウンロードできます</Text>
            ))}
          </View>
        ))}
      </View>
      {dlErr && <Text style={{ color: '#dc2626', marginTop: 4 }}>{dlErr}</Text>}
      <View style={[styles.row, { borderTopWidth: 1, borderColor: '#eee', paddingTop: 8, marginTop: 8 }]}>
        <Text style={{ flex: 1, fontWeight: 'bold' }}>合計</Text>
        <Text style={{ fontWeight: 'bold' }}>{yen(o.total_cents)}</Text>
      </View>
      {o.payment_kind && o.payment_kind !== 'free' && (
        <Text style={{ fontSize: 12, opacity: 0.6, textAlign: 'right' }}>お支払い方法: {o.payment_kind_label}</Text>
      )}
      {o.accepts_tips && <TipSection order={o} token={token} onChange={load} onPayByCard={payByCard} />}
      <Link href={{ pathname: '/service-request', params: { kind: 'inquiry', order_id: String(o.id) } }} style={styles.inquiry}>
        この注文について問い合わせる →
      </Link>
    </ScrollView>
  );
}

const TIP_PRESETS = [100, 300, 500, 1000];

// 投げ銭 (0円で販売した商品を含む注文)。カードは Stripe で支払い、振込などは店舗が入金を確認する
function TipSection({ order: o, token, onChange, onPayByCard }: {
  order: Order; token: string | null; onChange: () => void; onPayByCard: (path: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(300);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [cardEnabled, setCardEnabled] = useState(false);
  const [payment, setPayment] = useState<PaymentKind>('card');
  const paymentKind: PaymentKind = cardEnabled ? payment : 'transfer';

  useEffect(() => { fetchCardEnabled().then(setCardEnabled); }, []);

  async function send() {
    setBusy(true);
    setNote(null);
    try {
      const tip = await api<{ id: number; card_payable: boolean }>(`/orders/${o.id}/tips`, {
        method: 'POST', body: jsonBody({ amount_cents: amount, message, payment_kind: paymentKind }), auth: token,
      });
      setMessage('');
      onChange();
      if (tip.card_payable) await onPayByCard(`/orders/${o.id}/tips/${tip.id}/checkout_session`);
      else setNote('ありがとうございます！ お支払い方法 (振込先など) はショップからご連絡します。');
    } catch (e) {
      setNote(e instanceof Error ? e.message : '送信に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.tip}>
      <Text style={{ fontWeight: 'bold' }}>☕ 投げ銭で応援する</Text>
      <Text style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        無料でお届けした作品が含まれています。お好きな金額で制作を応援できます (任意)。
      </Text>
      <View style={styles.presets}>
        {TIP_PRESETS.map((p) => (
          <Pressable key={p} onPress={() => setAmount(p)} accessibilityState={{ selected: amount === p }}
                     style={[styles.preset, amount === p && styles.presetOn]}>
            <Text style={{ color: amount === p ? '#fff' : ACCENT }}>{yen(p)}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={message} onChangeText={setMessage} placeholder="メッセージ (任意)" maxLength={500} multiline style={styles.tipInput} />
      {cardEnabled && (
        <View style={[styles.presets, { backgroundColor: 'transparent' }]}>
          {([['card', 'クレジットカード'], ['transfer', '銀行振込など']] as const).map(([kind, label]) => (
            <Pressable key={kind} onPress={() => setPayment(kind)} accessibilityRole="radio" accessibilityState={{ checked: payment === kind }}
                       style={[styles.preset, payment === kind && styles.presetOn]}>
              <Text style={{ color: payment === kind ? '#fff' : ACCENT, fontSize: 12 }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Pressable onPress={send} disabled={busy} style={[styles.download, { marginTop: 8, paddingVertical: 8 }]}>
        <Text style={{ color: '#fff' }}>{busy ? '送信中…' : `${yen(amount)} を${paymentKind === 'card' ? 'カードで' : ''}投げ銭する`}</Text>
      </Pressable>
      {note && <Text style={{ fontSize: 12, marginTop: 6 }}>{note}</Text>}
      {(o.tips ?? []).map((t) => (
        <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, backgroundColor: 'transparent' }}>
          <Text style={{ fontSize: 12, opacity: 0.8 }}>
            {yen(t.amount_cents)} · {t.status_label}{t.payment_kind === 'card' ? ' · カード' : ''} · {fmtDate(t.created_at)}
          </Text>
          {t.card_payable && (
            <Pressable onPress={() => onPayByCard(`/orders/${o.id}/tips/${t.id}/checkout_session`)}>
              <Text style={{ fontSize: 12, color: ACCENT }}>カードで支払う</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

// 注文受付 → … → 完了 の進み具合 (制作状況の見える化)
function Progress({ order: o }: { order: Order }) {
  if (o.status === 'cancelled') return <Text style={styles.cancelled}>この注文はキャンセルされました。</Text>;
  const steps: OrderStatus[] = o.physical === false ? DIGITAL_FLOW : [...ORDER_FLOW];
  // 完了した注文はすべての工程を「済み」にする
  const current = o.status === 'completed' ? steps.length : steps.indexOf(o.status);
  const enteredAt = new Map((o.events ?? []).map((e) => [e.status, e.created_at]));
  return (
    <View style={styles.progress}>
      {steps.map((s, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <View key={s} style={styles.step} accessibilityState={{ selected: now }}>
            <View style={[styles.dot, done && styles.dotDone, now && styles.dotNow]}>
              <Text style={{ fontSize: 10, color: done ? '#fff' : now ? ACCENT : '#8c8c86', fontWeight: '700' }}>{done ? '✓' : i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, !done && !now && { opacity: 0.45 }, now && { fontWeight: '700' }]}>
              {ORDER_STATUS_LABEL[s]}
            </Text>
            {(done || now) && enteredAt.get(s) && <Text style={styles.stepDate}>{fmtDate(enteredAt.get(s)).split(' ')[0]}</Text>}
          </View>
        );
      })}
      {o.due_on && o.status !== 'completed' && <Text style={styles.stepDate}>発送予定日: {o.due_on}（目安）</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ededea', gap: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ededea' },
  dotDone: { backgroundColor: ACCENT },
  dotNow: { backgroundColor: '#fff', borderWidth: 2, borderColor: ACCENT },
  stepLabel: { flex: 1, fontSize: 13 },
  stepDate: { fontSize: 11, opacity: 0.55 },
  cancelled: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#f7f7f5', opacity: 0.8 },
  inquiry: { color: ACCENT, marginTop: 20, textAlign: 'center' },
  title: { fontSize: 22, fontWeight: 'bold' },
  row: { flexDirection: 'row', paddingVertical: 4 },
  downloads: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  download: { alignSelf: 'flex-start', backgroundColor: ACCENT, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  guide: { backgroundColor: '#fff', borderWidth: 1, borderColor: ACCENT },
  tip: { marginTop: 16, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#f3c8b8', backgroundColor: '#fff7f3' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  preset: { borderWidth: 1, borderColor: ACCENT, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#fff' },
  presetOn: { backgroundColor: ACCENT },
  tipInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, marginTop: 8, minHeight: 44, backgroundColor: '#fff' },
});
