// 設定画面の文言(ゲームデータではなく画面のドキュメント)。
import type { VipRank } from '../../data/types';

/** DESIGN.md §11 未確定事項と扱い */
export const UNRESOLVED_ITEMS: { item: string; handling: string; change: string }[] = [
  {
    item: 'JMSのキューブ確率・対応',
    handling: 'KMSのレッド/ブラック/エディショナルを対応付け',
    change: 'データ(cubes.json)',
  },
  { item: 'JMSのキューブ価格', handling: 'パック価格から算出した初期値', change: '設定' },
  {
    item: 'JMSの天井(等級上昇保証)',
    handling: '使わない',
    change: '設定「等級上昇保証を期待値に入れる」',
  },
  { item: '★22以上の費用倍率', handling: '1.0(KMS)', change: '設定 1.0 / 1.2' },
  { item: 'VIP割引の上限★', handling: '現在★16まで', change: 'データ(starforce.json)' },
  {
    item: '破壊時の復旧メル・個数',
    handling: 'KMSの比率・個数',
    change: 'データ(starforce.json)',
  },
  { item: '武器★の一部段階', handling: '計算しない', change: 'データ追記' },
  { item: '非ボス武器の炎攻撃力', handling: 'GMS系の式', change: 'データ(flame.json)' },
  { item: '黒い転生の炎の入手可否', handling: '選択肢に残す', change: '設定「基準の炎」' },
  { item: 'メル換算レート', handling: '1億メル=100NP', change: '設定「1NPあたりのメル」' },
  {
    item: '★の可否(部位以外)',
    handling: '強化可能回数>0 かつ 装備固有の成長システムでない装備だけ★可(補助武器も同じ)',
    change: 'データ(items.json の tuc / exGrade)',
  },
];

export const VIP_LABEL_JA: Record<VipRank, string> = {
  none: 'なし',
  silver: 'シルバー',
  gold: 'ゴールド',
  diamond: 'ダイヤモンド',
  royal: 'ロイヤル',
};

export const VIP_ORDER: readonly VipRank[] = ['none', 'silver', 'gold', 'diamond', 'royal'];

export function fmtNum(n: number): string {
  return n.toLocaleString('ja-JP', { maximumFractionDigits: 6 });
}

export function onOff(b: boolean): string {
  return b ? 'オン' : 'オフ';
}

/** 深い比較(設定値は JSON なので文字列化で比べる) */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
