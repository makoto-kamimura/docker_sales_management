import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { api, jsonBody } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen } from '@/lib/format';
import { fetchCardEnabled, fetchLegalNotice, openLegalNotice } from '@/lib/payments';
import type { Address, Cart, LegalNotice, Order, PaymentKind } from '@/lib/types';

export default function CheckoutScreen() {
  const { token } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cardEnabled, setCardEnabled] = useState(false);
  const [payment, setPayment] = useState<PaymentKind>('card');
  const [notice, setNotice] = useState<LegalNotice | null>(null);

  useEffect(() => { fetchLegalNotice().then(setNotice); }, []);

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        const [c, a, card] = await Promise.all([
          api<Cart>('/cart', { auth: token }),
          api<Address[]>('/me/addresses', { auth: token }),
          fetchCardEnabled(),
        ]);
        setCart(c); setAddresses(a); setAddressId(a[0]?.id ?? null); setCardEnabled(card);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'エラー');
      }
    })();
  }, [token]);

  const needsAddress = cart?.requires_shipping ?? true; // デジタル商品のみなら配送先不要
  // 0円の注文 (無料配布だけ) は支払いがない
  const free = cart?.subtotal_cents === 0;
  const paymentKind: PaymentKind = cardEnabled && !free ? payment : 'transfer';

  async function place() {
    if (needsAddress && !addressId) { setErr('住所が未登録です'); return; }
    setBusy(true); setErr(null);
    try {
      const body = { payment_kind: paymentKind, ...(needsAddress ? { address_id: addressId } : {}) };
      const o = await api<Order>('/orders', { method: 'POST', body: jsonBody(body), auth: token });
      // カードは注文詳細から決済の画面を開く (閉じたら注文詳細で取り直す)
      router.replace({ pathname: '/orders/[id]', params: { id: String(o.id), ...(o.card_payable ? { pay: '1' } : {}) } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'エラー');
    } finally {
      setBusy(false);
    }
  }

  if (!token) return <Text style={{ padding: 16 }}>ログインが必要です。</Text>;
  if (!cart) return <Text style={{ padding: 16 }}>読み込み中…</Text>;
  const disabled = busy || cart.items.length === 0 || (needsAddress && addresses.length === 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>ご注文確認</Text>

      {needsAddress ? (
        <>
          <Text style={styles.h2}>お届け先</Text>
          {addresses.length === 0 ? (
            <Text>先にアプリのアカウント画面で住所を登録してください。</Text>
          ) : (
            addresses.map((a) => (
              <Pressable key={a.id} onPress={() => setAddressId(a.id)} style={[styles.address, a.id === addressId && styles.selected]}>
                <Text style={{ fontWeight: '600' }}>{a.recipient}</Text>
                <Text style={{ fontSize: 12, opacity: 0.7 }}>〒{a.postal_code} {a.prefecture}{a.city}{a.line1}</Text>
              </Pressable>
            ))
          )}
        </>
      ) : (
        <>
          <Text style={styles.h2}>お届け方法</Text>
          <Text style={{ fontSize: 13, opacity: 0.7 }}>ダウンロード (配送なし・送料無料)。お支払い確認後、注文詳細からダウンロードできます。</Text>
        </>
      )}

      <Text style={styles.h2}>明細</Text>
      {cart.items.map((i) => (
        <View key={i.id} style={styles.row}>
          <Text style={{ flex: 1 }}>{i.name} {i.is_digital ? '(データ)' : `× ${i.quantity}`}</Text>
          <Text>{yen(i.line_total_cents)}</Text>
        </View>
      ))}
      <View style={[styles.row, { marginTop: 12 }]}>
        <Text style={{ flex: 1, opacity: 0.7 }}>小計</Text><Text>{yen(cart.subtotal_cents)}</Text>
      </View>
      <View style={styles.row}><Text style={{ flex: 1, opacity: 0.7 }}>消費税</Text><Text>{yen(cart.tax_cents)}</Text></View>
      <View style={styles.row}><Text style={{ flex: 1, opacity: 0.7 }}>送料</Text><Text>{yen(cart.shipping_cents)}</Text></View>
      <View style={styles.row}>
        <Text style={{ flex: 1, fontWeight: 'bold' }}>お支払い金額（税込）</Text>
        <Text style={{ fontWeight: 'bold' }}>{yen(cart.total_cents)}</Text>
      </View>

      {cardEnabled && !free && (
        <>
          <Text style={styles.h2}>お支払い方法</Text>
          {([
            ['card', 'クレジットカード', '決済サービス (Stripe) の画面でカード情報を入力します。カード情報はアプリに保存しません。'],
            ['transfer', '銀行振込など', 'ご注文後にショップからお支払い方法をご連絡します。'],
          ] as const).map(([kind, label, note]) => (
            <Pressable key={kind} onPress={() => setPayment(kind)} accessibilityRole="radio"
                       accessibilityState={{ checked: payment === kind }}
                       style={[styles.address, payment === kind && styles.selected]}>
              <Text style={{ fontWeight: '600' }}>{label}</Text>
              <Text style={{ fontSize: 12, opacity: 0.7 }}>{note}</Text>
            </Pressable>
          ))}
        </>
      )}

      <Text style={styles.h2}>ご注文前にご確認ください</Text>
      {!free && (
        <>
          <Text style={styles.label}>お支払い時期</Text>
          <Text style={styles.note}>
            {paymentKind === 'card'
              ? 'ご注文の確定後に開く決済画面で、クレジットカードでお支払いいただきます。'
              : notice?.transfer_payment_due || 'ご注文後にショップから振込先をご連絡します。'}
          </Text>
        </>
      )}
      <Text style={styles.label}>お届け時期</Text>
      {needsAddress && <Text style={styles.note}>{notice?.shipping_lead_time || '入金確認後に制作・発送します。'}</Text>}
      {cart.items.some((i) => i.is_digital) && (
        <Text style={styles.note}>3Dデータ・DIY設計図は、お支払いの確認後すぐに注文詳細からダウンロードできます。</Text>
      )}
      {notice?.returns_policy ? (
        <>
          <Text style={styles.label}>返品・交換・キャンセル</Text>
          <Text style={styles.note}>{notice.returns_policy}</Text>
        </>
      ) : null}
      <Pressable onPress={openLegalNotice} accessibilityRole="link">
        <Text style={{ color: '#ff5722', fontSize: 12, marginTop: 8 }}>特定商取引法に基づく表記 →</Text>
      </Pressable>

      {err && <Text style={{ color: '#dc2626', marginTop: 8 }}>{err}</Text>}
      <Pressable onPress={place} disabled={disabled} style={[styles.cta, disabled && { opacity: 0.5 }]}>
        <Text style={{ color: '#fff' }}>{paymentKind === 'card' ? '上記の内容で注文を確定し、カードで支払う' : '上記の内容で注文を確定する'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: 'bold' },
  h2: { marginTop: 16, fontWeight: 'bold' },
  address: { padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, marginTop: 6 },
  selected: { borderColor: '#111', backgroundColor: '#f5f5f5' },
  row: { flexDirection: 'row', paddingVertical: 4 },
  label: { marginTop: 8, fontSize: 12, fontWeight: '600', opacity: 0.6 },
  note: { fontSize: 13, marginTop: 2 },
  cta: { marginTop: 16, backgroundColor: '#111', padding: 14, borderRadius: 8, alignItems: 'center' },
});
