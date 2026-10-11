"""追加オプション(転生の炎)の参照実装(検証用)。全列挙で 1回の炎の結果分布を求める。"""
import json, os, itertools, math
from fractions import Fraction
F = json.load(open(os.path.join(os.path.dirname(__file__), '../../public/data/flame.json')))

def values(opt, s, L, baseAtt=0, boss=True, weapon=False):
    if opt in ('STR', 'DEX', 'INT', 'LUK'):
        Lp = 220 if L >= 250 else L
        return {opt: (Lp // 20 + 1) * s}
    if '_' in opt and opt.count('_') == 1 and opt not in ('REQ_LV', 'BOSS_DMG', 'ALL_STAT_P'):
        a, b = opt.split('_'); v = (L // 40 + 1) * s
        return {a: v, b: v}
    if opt == 'ATT':
        if weapon:
            # ボス武器: ceil(B*(floor(L/40)+1)*s*1.1^(s-3)/100) を有理数で
            x = Fraction(baseAtt * (L // 40 + 1) * s, 100) * Fraction(11, 10) ** (s - 3)
            return {'ATT': math.ceil(x)}
        return {'ATT': s}
    if opt == 'ALL_STAT_P': return {'AS': s}
    if opt == 'BOSS_DMG': return {'BOSS': 2 * s}
    if opt == 'DMG': return {'DMG': s}
    return {}

def dist(L, flame='eternal', boss=True, weapon=False, baseAtt=0, w=None):
    """スコア分布 {score: prob}。w: 重み dict(STR,DEX,...,ATT,AS,BOSS,DMG)"""
    pool = F['optionPools']['weapon' if weapon else 'armor']
    tiers = F['tierProbBase_1to5'][flame]
    shift = F['bossTierBonus'] if boss else 0
    tierDist = [(i + 1 + shift, p) for i, p in enumerate(tiers) if p > 0]
    lineCounts = {4: 1.0} if boss else {int(k): v for k, v in F['lineCountProb']['flameNonBoss'].items()}
    out = {}
    for n, pn in lineCounts.items():
        combos = list(itertools.combinations(pool, n))
        pc = pn / len(combos)
        for combo in combos:
            # 各行の段階を独立に
            per = []
            for opt in combo:
                d = {}
                for s, p in tierDist:
                    v = values(opt, s, L, baseAtt, boss, weapon)
                    sc = sum(w.get(k, 0) * x for k, x in v.items())
                    d[sc] = d.get(sc, 0) + p
                per.append(d)
            acc = {0: 1.0}
            for d in per:
                nxt = {}
                for a, pa in acc.items():
                    for b, pb in d.items():
                        nxt[a + b] = nxt.get(a + b, 0) + pa * pb
                acc = nxt
            for k, v in acc.items():
                k = round(k, 6)
                out[k] = out.get(k, 0) + v * pc
    return out

if __name__ == '__main__':
    W = {'STR': 1, 'ATT': 4, 'AS': 10}
    res = []
    for L in (160, 200, 250):
        for fl in ('powerful', 'eternal'):
            d = dist(L, fl, True, False, 0, W)
            mean = sum(k * v for k, v in d.items())
            row = {'L': L, 'flame': fl, 'mean': round(mean, 2)}
            for t in (100, 120, 140):
                row[f'P>={t}'] = round(sum(v for k, v in d.items() if k >= t), 6)
            res.append(row)
    ref = F['referenceResults_bossArmor_main1_att4_as10']
    for r in res:
        m = next((x for x in ref if x['L'] == r['L'] and x['flame'] == r['flame']), None)
        print(r, '\n   ref', m)
    # 武器: ボス武器 Lv200 基本攻326(ジェネシス片手剣) 攻撃力段階の検算
    print('genesis att tiers', [values('ATT', s, 200, 326, True, True)['ATT'] for s in range(3, 8)], 'expect [59, 87, 119, 157, 201]')
    print('absolab gun', [values('ATT', s, 160, 150, True, True)['ATT'] for s in range(3, 8)], 'expect [23, 33, 46, 60, 77]')
    json.dump(res, open(os.path.join(os.path.dirname(__file__), 'flame_expected.json'), 'w'), indent=1)
