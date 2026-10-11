// 強化順序タブの表示用の整形(純粋関数)。DESIGN.md §6.5.2 / §7.3 / §8。
import type { Grade } from '../../data/types';
import type { PotGrade } from '../../domain/character';
import type { PlanGroup, Quartile } from '../../domain/planTypes';

const OKU = 100_000_000;
const MAN = 10_000;
const DASH = '—';

function group(n: number, maxFractionDigits = 0): string {
  return n.toLocaleString('ja-JP', { maximumFractionDigits: maxFractionDigits });
}

/**
 * メルの表示。1億以上 → `3.5億メル`(1,000億以上は整数 `1,234億メル`)、1万以上 → `5,678万メル`、
 * それ未満 → `1,234メル`。負・NaN・無限大は '—'。
 */
export function formatMel(n: number): string {
  if (!Number.isFinite(n) || n < 0) return DASH;
  if (n >= OKU) {
    const v = n / OKU;
    return `${group(v, v >= 1000 ? 0 : 1)}億メル`;
  }
  if (n >= MAN) {
    const v = Math.round(n / MAN);
    if (v >= 10_000) return `${group(n / OKU, 1)}億メル`;
    return `${group(v)}万メル`;
  }
  return `${group(Math.round(n))}メル`;
}

/** 戦闘力(整数・3桁区切り) */
export function formatCP(n: number): string {
  if (!Number.isFinite(n)) return DASH;
  return group(Math.round(n));
}

/** 戦闘力の上昇(+付き) */
export function formatGain(n: number): string {
  if (!Number.isFinite(n)) return DASH;
  const r = Math.round(n);
  return `${r >= 0 ? '+' : '−'}${group(Math.abs(r))}`;
}

/** すでに % 単位の値を表示(例: formatPct(1.234, 2) → '1.23%') */
export function formatPct(x: number, digits = 1): string {
  if (!Number.isFinite(x)) return DASH;
  return `${x.toLocaleString('ja-JP', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

/**
 * 確率(0〜1)を % で表示。10%以上は小数1桁、1%以上は2桁、
 * それ未満は有効数字2桁(0.0012 → '0.12%'、0.00021979 → '0.022%')。
 */
export function formatProb(p: number): string {
  if (!Number.isFinite(p) || p < 0) return DASH;
  const pct = p * 100;
  if (pct === 0) return '0%';
  let digits: number;
  if (pct >= 10) digits = 1;
  else if (pct >= 1) digits = 2;
  else digits = Math.min(6, Math.ceil(-Math.log10(pct)) + 1);
  const s = pct.toFixed(digits).replace(/\.?0+$/, '');
  return `${s}%`;
}

/** 個数・回数など(既定 小数1桁) */
export function formatCount(n: number, digits = 1): string {
  if (!Number.isFinite(n) || n < 0) return DASH;
  return n.toLocaleString('ja-JP', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** 効率(1億メルあたりの戦闘力上昇)。例: '+1,234 / 億メル' */
export function formatEfficiency(eff: number): string {
  if (!Number.isFinite(eff) || eff < 0) return DASH;
  const v = eff * OKU;
  const s = v >= 100 ? group(v) : v >= 1 ? group(v, 1) : v.toPrecision(2);
  return `+${s} / 億メル`;
}

export const QUARTILES: readonly Quartile[] = [1, 2, 3, 4];

/** 四分位のラベル(色だけに頼らないための文字表示) */
export function quartileLabel(q: Quartile): string {
  switch (q) {
    case 1:
      return '上位25%';
    case 2:
      return '25–50%';
    case 3:
      return '50–75%';
    case 4:
      return '下位25%';
  }
}

export interface QuartileStyle {
  border: string;
  text: string;
  bg: string;
}

/** Tailwind のクラス名(JIT が拾えるよう完全な文字列で持つ) */
export const QUARTILE_STYLE: Record<Quartile, QuartileStyle> = {
  1: { border: 'border-effGreen', text: 'text-effGreen', bg: 'bg-effGreen' },
  2: { border: 'border-effPurple', text: 'text-effPurple', bg: 'bg-effPurple' },
  3: { border: 'border-effYellow', text: 'text-effYellow', bg: 'bg-effYellow' },
  4: { border: 'border-effRed', text: 'text-effRed', bg: 'bg-effRed' },
};

/** 枠と文字の色クラス */
export function quartileClass(q: Quartile): string {
  const s = QUARTILE_STYLE[q];
  return `${s.border} ${s.text}`;
}

/** 0 始まりの順位から四分位を出す(n 件中。炎の並びなど) */
export function quartileOfIndex(index: number, n: number): Quartile {
  if (n <= 0 || index < 0) return 1;
  const q = Math.floor((index * 4) / n) + 1;
  return Math.min(4, Math.max(1, q)) as Quartile;
}

export const GRADE_LABEL_JA: Record<PotGrade, string> = {
  none: 'なし',
  rare: 'レア',
  epic: 'エピック',
  unique: 'ユニーク',
  legendary: 'レジェンダリー',
};

/** 潜在等級の色(ゲーム内の等級色に寄せる) */
export const GRADE_TEXT_CLASS: Record<Grade, string> = {
  rare: 'text-sky-500',
  epic: 'text-effPurple',
  unique: 'text-effYellow',
  legendary: 'text-effGreen',
};

export const GRADE_BORDER_CLASS: Record<Grade, string> = {
  rare: 'border-sky-500',
  epic: 'border-effPurple',
  unique: 'border-effYellow',
  legendary: 'border-effGreen',
};

export const KIND_LABEL_JA = {
  starforce: 'スターフォース',
  potential: '潜在能力',
  additional: 'アディショナル',
} as const;

/** マスの読み上げラベル。例: '3位 アブソラブスハット ★20→22 効率上位25%' */
export function groupAriaLabel(g: PlanGroup): string {
  let what: string;
  if (g.kind === 'starforce') {
    what = g.from !== undefined && g.to !== undefined ? `★${g.from}→${g.to}` : `★${g.cellLabel}`;
  } else {
    const first = g.steps[0];
    const target = first && first.kind !== 'starforce' ? first.targetLabel : g.cellLabel;
    what = `${g.kind === 'potential' ? '潜在' : 'アディ'} ${target}`;
  }
  return `${g.rank}位 ${g.equipName} ${what} 効率${quartileLabel(g.quartile)}`;
}

export type AssumptionTag = '推定' | '代用表' | 'クール減換算';

/** 前提の文から目立たせる印を選ぶ */
export function assumptionTags(text: string): AssumptionTag[] {
  const tags: AssumptionTag[] = [];
  if (text.includes('推定')) tags.push('推定');
  if (text.includes('代用')) tags.push('代用表');
  if (text.includes('クール減換算')) tags.push('クール減換算');
  return tags;
}

/** 重複を除いて順序を保つ */
export function uniqueStrings(list: readonly string[]): string[] {
  return Array.from(new Set(list));
}
