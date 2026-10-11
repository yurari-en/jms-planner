"""潜在能力: 「目標行の組合せが1回で揃う確率」の参照実装(検証用)。
目標 = 行カテゴリの多重集合(例: {攻撃力%>=9: 2, ボス%>=30: 1})。行の位置は問わない。
各行は lineDists に従い独立に抽選。ただし制限グループ(maxOne/maxTwo)を超える場合は
KMS公式どおり『除外して再正規化』(表記確率/(100-除外分))で次の行を抽選する。"""
import json, os, itertools
T = json.load(open(os.path.join(os.path.dirname(__file__), '../fixtures/kms-cube-tables.seed.json')))
OPT = T['options']

def table(cube, grade, part, lv):
    bands = T['tables'][f'{cube}/{grade}/{part}']
    b = [x for x in bands if x['minLv'] <= lv][-1]
    return [T['lineDists'][i] for i in b['lines']]

def classify(opt, cats):
    """cats: [(name, predicate)] → 該当するカテゴリ名(最初に一致したもの) or None"""
    for name, pred in cats:
        if pred(opt):
            return name
    return None

def prob_target(cube, grade, part, lv, cats, need):
    """need: {catName: count}。3行の中で各カテゴリが count 行以上あれば成功(1行は1カテゴリにしか数えない)。"""
    lines = table(cube, grade, part, lv)
    # 各行を (カテゴリ, 制限グループ) の状態に縮約
    def dist(line):
        d = {}
        for oid, p in line:
            o = OPT[oid]
            key = (classify(o, cats), o['group'])
            d[key] = d.get(key, 0) + p / 100
        return d
    D = [dist(l) for l in lines]
    total = 0.0
    def rec(i, used_groups, counts, pr):
        nonlocal total
        if i == 3:
            if all(counts.get(k, 0) >= v for k, v in need.items()):
                total += pr
            return
        d = D[i]
        excluded = 0.0
        for (c, g), p in d.items():
            if g == 'maxOne' and used_groups.get('maxOne', 0) >= 1: excluded += p
            if g == 'maxTwo' and used_groups.get('maxTwo', 0) >= 2: excluded += p
        norm = 1 - excluded
        for (c, g), p in d.items():
            if g == 'maxOne' and used_groups.get('maxOne', 0) >= 1: continue
            if g == 'maxTwo' and used_groups.get('maxTwo', 0) >= 2: continue
            ug = dict(used_groups)
            if g: ug[g] = ug.get(g, 0) + 1
            cc = dict(counts)
            if c: cc[c] = cc.get(c, 0) + 1
            rec(i + 1, ug, cc, pr * p / norm)
    rec(0, {}, {}, 1.0)
    return total

def ge(key, v, stat=None):
    return lambda o: o['key'] == key and o['value'] >= v and (stat is None or o.get('stat') == stat)

if __name__ == '__main__':
    cases = []
    def add(desc, cube, grade, part, lv, cats, need):
        p = prob_target(cube, grade, part, lv, cats, need)
        cases.append({'desc': desc, 'cube': cube, 'grade': grade, 'part': part, 'lv': lv,
                      'need': need, 'prob': p, 'expectedTries': (1 / p if p > 0 else None)})
    A = [('att', lambda o: o['key'] == 'attPct' and o['value'] >= 9)]
    add('武器Lv200 レジェ 攻撃力%(9%以上)1行以上', 'black', 'legendary', 'weapon', 200, A, {'att': 1})
    add('武器Lv200 レジェ 攻撃力%(9%以上)2行以上', 'black', 'legendary', 'weapon', 200, A, {'att': 2})
    add('武器Lv200 レジェ 攻撃力%(9%以上)3行', 'black', 'legendary', 'weapon', 200, A, {'att': 3})
    AB = [('att', lambda o: o['key'] == 'attPct' and o['value'] >= 9), ('boss', lambda o: o['key'] == 'bossPct' and o['value'] >= 30)]
    add('武器Lv200 レジェ 攻%2行+ボス30%以上1行', 'black', 'legendary', 'weapon', 200, AB, {'att': 2, 'boss': 1})
    S = [('main', lambda o: (o['key'] == 'statPct' and o.get('stat') == 'STR' and o['value'] >= 9))]
    add('帽子Lv160 レジェ STR%(9%以上)3行', 'black', 'legendary', 'hat', 160, S, {'main': 3})
    add('帽子Lv160 レジェ STR%(9%以上)2行', 'black', 'legendary', 'hat', 160, S, {'main': 2})
    C = [('cdr', lambda o: o['key'] == 'cdrSec' and o['value'] >= 2)]
    add('帽子Lv160 レジェ クール-2秒 1行', 'black', 'legendary', 'hat', 160, C, {'cdr': 1})
    G = [('cd', lambda o: o['key'] == 'critDmg' and o['value'] >= 8)]
    add('手袋Lv160 レジェ クリダメ8% 2行', 'black', 'legendary', 'gloves', 160, G, {'cd': 2})
    AD = [('att', lambda o: o['key'] == 'attFlat' and o['value'] >= 12)]
    add('上着Lv160 アディ レジェ 攻撃力+12以上 1行', 'additional', 'legendary', 'top', 160, AD, {'att': 1})
    add('上着Lv160 アディ レジェ 攻撃力+12以上 2行', 'additional', 'legendary', 'top', 160, AD, {'att': 2})
    AW = [('att', lambda o: o['key'] == 'attPct' and o['value'] >= 9)]
    add('武器Lv200 アディ レジェ 攻%(9%以上)1行', 'additional', 'legendary', 'weapon', 200, AW, {'att': 1})
    add('武器Lv200 アディ ユニーク 攻%(6%以上)1行', 'additional', 'unique', 'weapon', 200, [('att', lambda o: o['key'] == 'attPct' and o['value'] >= 6)], {'att': 1})
    json.dump(cases, open(os.path.join(os.path.dirname(__file__), 'potential_expected.json'), 'w'), ensure_ascii=False, indent=1)
    for c in cases: print(f"{c['desc']}: p={c['prob']:.6%}  期待{c['expectedTries']:.1f}回")
