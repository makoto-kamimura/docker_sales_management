"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import "./HeroPromo.css";

// 同じタブで一度再生したら、以降は最後の場面から表示する
const PLAYED_KEY = "craftflow:hero-played";
// HeroPromo.css の --dur（縦長 14s / 横長 15s）の長いほうに揃える
const DURATION_MS = 15000;

// 立体の「箱」は上・前・後・左・右の5面で組み立てる (HeroPromo.css の .box 参照)
function Box({ className }: { className: string }) {
  return (
    <div className={`box ${className}`}>
      <i className="u" />
      <i className="fr" />
      <i className="bk" />
      <i className="lf" />
      <i className="rt" />
    </div>
  );
}

const PARCEL = (
  <>
    <rect className="st" x="1022" y="74" width="56" height="48" rx="2" />
    <path className="st" d="M1022 91 H1078 M1050 74 V122" />
  </>
);

// 工程のアイコンは横向き図の座標で描き、(cx, cy) を中心として縦向き図では移動して使う
const STEPS: { label: string; cx: number; cy: number; icon: ReactNode }[] = [
  {
    label: "受付", cx: 150, cy: 95,
    icon: (
      <>
        <rect className="st" x="128" y="66" width="44" height="58" rx="3" />
        <path className="st" d="M139 86 H161 M139 98 H161 M139 110 H153" />
      </>
    ),
  },
  {
    label: "制作", cx: 450, cy: 96,
    icon: (
      <>
        <path className="st" d="M420 60 H480" />
        <g className="nozzle">
          <path d="M443 62 H457 L453 76 H447 Z" fill="var(--line)" />
          <circle cx="450" cy="79" r="2.6" fill="var(--spark)" />
        </g>
        <rect className="lay lay4" x="432" y="85" width="36" height="10" />
        <rect className="lay lay3" x="432" y="96" width="36" height="10" />
        <rect className="lay lay2" x="432" y="107" width="36" height="10" />
        <rect className="lay lay1" x="432" y="118" width="36" height="10" />
        <path className="st" d="M424 132 H476" />
      </>
    ),
  },
  {
    label: "検品", cx: 748, cy: 96,
    icon: (
      <>
        <circle className="st" cx="744" cy="92" r="21" />
        <path className="st" d="M759 107 L773 121" />
        <path className="st pass" d="M735 92 L742 100 L755 83" />
      </>
    ),
  },
  { label: "発送", cx: 1050, cy: 98, icon: PARCEL },
];

/**
 * 受付 → 制作 → 検品 → 発送 の工程図。
 * 横向き (横長の枠) と縦向き (縦長の枠) で配置だけが違い、アニメーションは共通。
 */
function ProcessDiagram({ vertical = false }: { vertical?: boolean }) {
  const pos = (i: number) => (vertical ? { x: 44, y: 60 + 120 * i } : { x: 150 + 300 * i, y: 180 });
  // 縦向きではアイコンをドットの右 (x=120) に並べる
  const move = (i: number) => {
    if (!vertical) return undefined;
    const s = STEPS[i];
    return `translate(${120 - s.cx} ${pos(i).y - s.cy})`;
  };
  return (
    <svg
      className={`diagram ${vertical ? "diagram-v" : "diagram-h"}`}
      viewBox={vertical ? "0 0 270 480" : "0 0 1200 300"}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ご注文が受付・制作・検品・発送と進んでいく様子"
    >
      {/* 工程ライン */}
      <path className="track" pathLength={100} d={vertical ? "M44 60 V420" : "M150 180 H1050"} />
      <path className="prog" pathLength={100} d={vertical ? "M44 60 V420" : "M150 180 H1050"} />

      {STEPS.map((s, i) => {
        const { x, y } = pos(i);
        return (
          <g key={s.label}>
            <g className={`ico ico${i + 1}`} transform={move(i)}>{s.icon}</g>
            <path className="tick" d={vertical ? `M58 ${y} H80` : `M${x} 140 V168`} />
            <circle className="dot" cx={x} cy={y} r="8.5" />
            <circle className={`on on${i + 1}`} cx={x} cy={y} r="8.5" />
            <text
              x={vertical ? 172 : x}
              y={vertical ? y + 10 : 222}
              textAnchor={vertical ? "start" : "middle"}
            >
              {s.label}
            </text>
          </g>
        );
      })}

      {/* 最後にひと箱、線の先へ出ていく */}
      <g transform={move(3)}>
        <g className="shipout">{PARCEL}</g>
      </g>
    </svg>
  );
}

// transform (ページ遷移のフェードイン) の影響を受けない、ページ上端からの位置
function pageTop(el: HTMLElement) {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
}

/**
 * トップのヒーロー。doc/hero.html のアニメーションを元にしたもの。
 * - 縦長の枠: 工程 → キャッチコピー → ブランドとボタン の3場面を順に見せ、最後の場面で止まる
 * - 横長の枠: 元のアニメーション（16:9 の舞台に全要素を並べ、出そろった最後のコマで止まる）
 * 切り替えは HeroPromo.css の @container。マークアップは共通。
 * 背景の家具は本編と独立して回り続ける。再生中もスクロールは自由。
 */
export function HeroPromo() {
  const ref = useRef<HTMLElement>(null);
  const promoRef = useRef<HTMLDivElement>(null);
  const finishRef = useRef<(instant: boolean) => void>(() => {});
  const [top, setTop] = useState<number | null>(null);
  // play: 再生中 / ended: 最後まで再生した / instant: スキップ・再訪問で最後の場面から表示
  const [mode, setMode] = useState<"play" | "ended" | "instant">("play");

  // ヒーローが画面の残りの高さに収まるよう、ページ上端からの位置を測る
  useEffect(() => {
    const measure = () => {
      if (ref.current) setTop(pageTop(ref.current));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // 家具のループは画面外にある間だけ止める。
  // className を React に管理させると再描画で消えるため、.promo に直接付け外しする
  useEffect(() => {
    const promo = promoRef.current;
    if (!promo) return;
    const io = new IntersectionObserver(([entry]) => {
      promo.classList.toggle("is-offscreen", !entry.isIntersecting);
    });
    io.observe(promo);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let played = false;
    try {
      played = sessionStorage.getItem(PLAYED_KEY) === "1";
    } catch {
      /* sessionStorage が使えない環境では毎回再生する */
    }
    if (played || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMode("instant");
      return;
    }

    let finished = false;
    // instant=false (最後まで再生) では遅延を書き換えない。書き換えると回り続けている家具の位相が飛ぶため
    const finish = (instant: boolean) => {
      if (finished) return;
      finished = true;
      setMode(instant ? "instant" : "ended");
      try {
        sessionStorage.setItem(PLAYED_KEY, "1");
      } catch {
        /* 保存できなくても表示には影響しない */
      }
    };
    finishRef.current = finish;

    const onEnd = (e: AnimationEvent) => {
      // 縦長は hp-brand、横長は hl-brand が本編の最後
      if (e.animationName === "hp-brand" || e.animationName === "hl-brand") finish(false);
    };
    el.addEventListener("animationend", onEnd);
    // animationend が届かない環境でも最後の場面を確実に出すための保険
    const timer = window.setTimeout(() => finish(true), DURATION_MS + 1000);

    return () => {
      el.removeEventListener("animationend", onEnd);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <section
      ref={ref}
      className={`hero${mode === "instant" ? " is-done" : ""}`}
      style={top === null ? undefined : ({ "--hero-top": `${top}px` } as CSSProperties)}
    >
      <div className="promo" ref={promoRef}>
        <div className="stage">
          {/* 背景：線 → テーブル → 椅子 → 棚 */}
          <div className="ghost" aria-hidden>
            <svg className="gplan" viewBox="0 0 400 280" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 100 H382 V114 H18 Z" />
              <path className="g2" d="M35 114 V241 H52 V114" />
              <path className="g2" d="M349 114 V241 H366 V114" />
            </svg>

            <div className="gbuild"><div className="grig"><div className="gspin">
              <div className="obj o-table">
                <Box className="b-top" />
                <Box className="b-tleg t1" />
                <Box className="b-tleg t2" />
                <Box className="b-tleg t3" />
                <Box className="b-tleg t4" />
              </div>

              <div className="obj o-chair">
                <Box className="b-seat" />
                <Box className="b-cleg c1" />
                <Box className="b-cleg c2" />
                <Box className="b-cleg c3" />
                <Box className="b-cleg c4" />
                <Box className="b-back" />
              </div>

              <div className="obj o-shelf">
                <Box className="b-side s1" />
                <Box className="b-side s2" />
                <Box className="b-board s3" />
                <Box className="b-board s4" />
                <Box className="b-board s5" />
              </div>
            </div></div></div>
          </div>

          {/* 場面1：工程。横長の枠は横向き、縦長の枠は縦向き — CSS で片方だけ表示する */}
          <div className="scene scene-flow">
            <ProcessDiagram />
            <ProcessDiagram vertical />
          </div>

          {/* 場面2：キャッチコピー（差し替え） */}
          <div className="scene scene-head">
            <h1 className="head">
              つくる、売る、届ける。<span>ひとつの流れで。</span>
            </h1>
          </div>

          {/* 場面3：ブランドとボタン。本編はこの場面で止まる（差し替え）
              横長では補足コピーが左下、.brand が右下に分かれる。縦長の並び順は CSS の order で決める */}
          <div className="scene scene-brand">
            <p className="sub">
              3Dプリント品・モデルデータ・ハンドメイド作品を、つくり手から直接。<br />
              ご注文は<b>いまどの工程にあるか</b>を、いつでも確認できます。
            </p>
            <div className="brand">
              <p className="shop">CraftFlow</p>
              <p className="tag">つくり手から直接とどく、ものづくりのお店</p>
              <div className="actions">
                <Link href="/search" className="cta">作品を探す</Link>
                <Link href="/custom" className="cta cta-outline">オーダーメイドを相談</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {mode === "play" && (
        <button type="button" className="hero-skip" onClick={() => finishRef.current(true)}>
          スキップ
        </button>
      )}
    </section>
  );
}
