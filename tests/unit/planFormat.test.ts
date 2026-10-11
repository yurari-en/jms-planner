import { describe, expect, it } from 'vitest';
import type { PlanGroup, SfStep } from '../../src/domain/planTypes';
import {
  assumptionTags,
  formatCP,
  formatCount,
  formatEfficiency,
  formatGain,
  formatMel,
  formatPct,
  formatProb,
  groupAriaLabel,
  quartileClass,
  quartileLabel,
  quartileOfIndex,
  uniqueStrings,
} from '../../src/components/plan/format';

describe('formatMel', () => {
  it('formats 億 with one decimal', () => {
    expect(formatMel(350_000_000)).toBe('3.5億メル');
    expect(formatMel(1_230_000_000)).toBe('12.3億メル');
    expect(formatMel(100_000_000)).toBe('1億メル');
  });
  it('formats ≥1000億 as grouped integer 億', () => {
    expect(formatMel(123_456_000_000)).toBe('1,235億メル');
    expect(formatMel(100_000_000_000)).toBe('1,000億メル');
  });
  it('formats 万', () => {
    expect(formatMel(56_780_000)).toBe('5,678万メル');
    expect(formatMel(10_000)).toBe('1万メル');
    // 万の丸めで 1億 に届くときは 億 表記
    expect(formatMel(99_999_999)).toBe('1億メル');
  });
  it('formats small values', () => {
    expect(formatMel(0)).toBe('0メル');
    expect(formatMel(1234)).toBe('1,234メル');
  });
  it('returns a dash for invalid values', () => {
    expect(formatMel(-1)).toBe('—');
    expect(formatMel(Number.NaN)).toBe('—');
    expect(formatMel(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('number helpers', () => {
  it('formatCP / formatGain', () => {
    expect(formatCP(50_123_456.7)).toBe('50,123,457');
    expect(formatCP(Number.NaN)).toBe('—');
    expect(formatGain(12345.4)).toBe('+12,345');
    expect(formatGain(-5)).toBe('−5');
  });
  it('formatPct', () => {
    expect(formatPct(1.234, 2)).toBe('1.23%');
    expect(formatPct(12.34)).toBe('12.3%');
    expect(formatPct(5, 1)).toBe('5.0%');
    expect(formatPct(Number.NaN)).toBe('—');
  });
  it('formatProb uses 1–3 significant decimals', () => {
    expect(formatProb(0.0012)).toBe('0.12%');
    expect(formatProb(0.172231)).toBe('17.2%');
    expect(formatProb(0.0106168)).toBe('1.06%');
    expect(formatProb(0.00021979)).toBe('0.022%');
    expect(formatProb(0)).toBe('0%');
    expect(formatProb(1)).toBe('100%');
    expect(formatProb(Number.NaN)).toBe('—');
  });
  it('formatCount / formatEfficiency', () => {
    expect(formatCount(12.345)).toBe('12.3');
    expect(formatCount(0.5, 2)).toBe('0.50');
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatEfficiency(1234 / 100_000_000)).toBe('+1,234 / 億メル');
    expect(formatEfficiency(Number.NaN)).toBe('—');
  });
});

describe('quartiles', () => {
  it('labels and classes', () => {
    expect(quartileLabel(1)).toBe('上位25%');
    expect(quartileLabel(2)).toBe('25–50%');
    expect(quartileLabel(3)).toBe('50–75%');
    expect(quartileLabel(4)).toBe('下位25%');
    expect(quartileClass(1)).toContain('border-effGreen');
    expect(quartileClass(2)).toContain('border-effPurple');
    expect(quartileClass(3)).toContain('border-effYellow');
    expect(quartileClass(4)).toContain('border-effRed');
  });
  it('quartileOfIndex splits ranks into four buckets', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => quartileOfIndex(i, 8))).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4,
    ]);
    expect(quartileOfIndex(0, 1)).toBe(1);
    expect(quartileOfIndex(2, 3)).toBe(3);
    expect(quartileOfIndex(0, 0)).toBe(1);
  });
});

describe('groupAriaLabel', () => {
  const step: SfStep = {
    id: 'hat:sf:0',
    kind: 'starforce',
    slot: 'hat',
    equipName: 'アブソラブスハット',
    itemId: null,
    lv: 160,
    gain: 1,
    gainPct: 0.1,
    cost: 1,
    efficiency: 1,
    rank: 3,
    quartile: 1,
    cpBefore: 1,
    cpAfter: 2,
    assumptions: [],
    from: 20,
    to: 22,
    destroys: 0,
  };
  it('describes a star group', () => {
    const g: PlanGroup = {
      id: 'g',
      kind: 'starforce',
      slot: 'hat',
      equipName: 'アブソラブスハット',
      itemId: null,
      steps: [step],
      from: 20,
      to: 22,
      cellLabel: '20→22',
      totalGain: 1,
      totalCost: 1,
      efficiency: 1,
      rank: 3,
      quartile: 1,
    };
    expect(groupAriaLabel(g)).toBe('3位 アブソラブスハット ★20→22 効率上位25%');
  });
});

describe('misc', () => {
  it('assumptionTags', () => {
    expect(assumptionTags('ネオキューブ は KMS レッド表に対応付け(推定)')).toEqual(['推定']);
    expect(assumptionTags('レッド表が無いためブラック表で代用')).toEqual(['代用表']);
    expect(assumptionTags('クール減換算: 2秒 = レジェ主ステ 1.5 行')).toEqual(['クール減換算']);
    expect(assumptionTags('KMS公式の確率')).toEqual([]);
  });
  it('uniqueStrings keeps order', () => {
    expect(uniqueStrings(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
  });
});
