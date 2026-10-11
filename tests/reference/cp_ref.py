"""戦闘力モデル(DESIGN.md §6.1)の参照実装。架空キャラで Δ を与えたときの上昇量を出す。"""
import json, os
CH = {  # 架空: 標準式(主STR/副DEX)
  'displayedCP': 80_000_000, 'level': 270,
  'STR': {'final': 52000, 'pct': 330, 'nonPct': 21000}, 'DEX': {'final': 6200, 'pct': 60, 'nonPct': 1500},
  'attack': {'final': 7800, 'pct': 95}, 'dmgPct': 80, 'bossPct': 350, 'critDmgPct': 110,
}
def factors(ch, d):
    def stat(X):
        s = ch[X]; base = (s['final'] - s['nonPct']) / (1 + s['pct'] / 100)
        return (base + d.get('flat_' + X, 0)) * (1 + (s['pct'] + d.get('pct_' + X, 0)) / 100) + s['nonPct'] + d.get('nonPct_' + X, 0)
    S = 4 * stat('STR') + stat('DEX')
    attFlat = ch['attack']['final'] / (1 + ch['attack']['pct'] / 100)
    A = (attFlat + d.get('attFlat', 0)) * (1 + (ch['attack']['pct'] + d.get('attPct', 0)) / 100)
    D = 1 + (ch['dmgPct'] + ch['bossPct'] + d.get('dmgPct', 0) + d.get('bossPct', 0)) / 100
    C = 1.35 + (ch['critDmgPct'] + d.get('critDmgPct', 0)) / 100
    return S, A, D, C
def gain(ch, d):
    f0 = factors(ch, {}); f1 = factors(ch, d)
    r = 1.0
    for a, b in zip(f0, f1): r *= b / a
    return ch['displayedCP'] * r - ch['displayedCP']
cases = {
  'zero': {},
  'mainPct+12': {'pct_STR': 12},
  'allStatPct+9': {'pct_STR': 9, 'pct_DEX': 9},
  'mainFlat+100': {'flat_STR': 100},
  'att+30': {'attFlat': 30},
  'attPct+12': {'attPct': 12},
  'boss+40': {'bossPct': 40},
  'critDmg+8': {'critDmgPct': 8},
  'perLv(9,+2)': {'nonPct_STR': 2 * (270 // 9)},
}
out = {'character': CH, 'cases': {k: gain(CH, v) for k, v in cases.items()}, 'deltas': cases}
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'cp_expected.json'), 'w'), ensure_ascii=False, indent=1)
for k, v in out['cases'].items(): print(f'{k}: +{v:,.1f}')
