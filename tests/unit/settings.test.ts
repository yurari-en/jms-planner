// メル換算レート(メルマーケットの相場 → 1NPあたりのメル)の計算。
import { describe, expect, it } from 'vitest';
import { MEL_PER_MARKET_UNIT, melPerNP } from '../../src/domain/settings';

describe('melPerNP', () => {
  it('1NPあたりのメル = 1億 ÷ 1億メルあたりのポイント数', () => {
    expect(MEL_PER_MARKET_UNIT).toBe(100_000_000);
    expect(melPerNP({ pointsPer100MMel: 130 })).toBeCloseTo(769230.769, 2);
    expect(melPerNP({ pointsPer100MMel: 100 })).toBe(1_000_000);
  });

  it('0 や NaN などの不正値はキューブを無料にしないよう Infinity', () => {
    expect(melPerNP({ pointsPer100MMel: 0 })).toBe(Number.POSITIVE_INFINITY);
    expect(melPerNP({ pointsPer100MMel: -1 })).toBe(Number.POSITIVE_INFINITY);
    expect(melPerNP({ pointsPer100MMel: Number.NaN })).toBe(Number.POSITIVE_INFINITY);
  });
});
