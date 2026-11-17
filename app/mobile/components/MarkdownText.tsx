import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Markdown の簡易表示 (依存を足さない)。問い合わせ・依頼の本文と、AIコンシェルジュの制作依頼書に使う。
 * 見出し・箇条書き・番号付きの行・引用・段落・**太字** と、バックスラッシュのエスケープだけを扱う。
 * それ以外の記法 (表・リンク・HTML など) は文字のまま出す
 */
export function MarkdownText({ children, color = '#1b1b19', fontSize = 14 }: { children: string; color?: string; fontSize?: number }) {
  const lineHeight = Math.round(fontSize * 1.55);
  const base = { color, fontSize, lineHeight };
  const lines = children.replace(/\r\n?/g, '\n').split('\n');

  return (
    <View>
      {lines.map((raw, i) => {
        const heading = raw.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
          const size = heading[1].length === 1 ? fontSize + 3 : heading[1].length === 2 ? fontSize + 1 : fontSize;
          return (
            <Text key={i} style={[base, styles.heading, { fontSize: size, lineHeight: Math.round(size * 1.5) }, i === 0 && { marginTop: 0 }]}>
              <Inline text={heading[2]} />
            </Text>
          );
        }
        const bullet = raw.match(/^\s*[-*+]\s+(.*)$/);
        const numbered = raw.match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (bullet || numbered) {
          return (
            <View key={i} style={styles.item}>
              <Text style={[base, styles.marker]}>{bullet ? '•' : `${numbered![1]}.`}</Text>
              <Text style={[base, styles.itemText]}><Inline text={bullet ? bullet[1] : numbered![2]} /></Text>
            </View>
          );
        }
        const quote = raw.match(/^>\s?(.*)$/);
        if (quote) {
          return (
            <Text key={i} style={[base, styles.quote]}>
              <Inline text={quote[1]} />
            </Text>
          );
        }
        if (!raw.trim()) return <View key={i} style={{ height: lineHeight / 2 }} />;
        return (
          <Text key={i} style={base}>
            <Inline text={raw} />
          </Text>
        );
      })}
    </View>
  );
}

/** 行の中の **太字** とエスケープ (\# \[ \< 1\. など) */
function Inline({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i % 2 === 1 ? <Text style={styles.bold}>{unescape(part)}</Text> : unescape(part)}
        </Fragment>
      ))}
    </>
  );
}

function unescape(text: string) {
  return text.replace(/\\([\\`*_{}[\]()#+\-.!<>|~=])/g, '$1');
}

const styles = StyleSheet.create({
  heading: { fontWeight: '700', marginTop: 10, marginBottom: 2 },
  item: { flexDirection: 'row', gap: 6, paddingLeft: 2 },
  marker: { opacity: 0.6 },
  itemText: { flex: 1 },
  quote: { borderLeftWidth: 2, borderLeftColor: '#c9c9c4', paddingLeft: 8, opacity: 0.8 },
  bold: { fontWeight: '700' },
});
