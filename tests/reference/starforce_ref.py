"""スターフォース期待値の参照実装(検証用)。アプリ(TypeScript)の実装はこの結果と一致させる。"""
import json, math, sys, os
D = json.load(open(os.path.join(os.path.dirname(__file__), '../../public/data/starforce.json')))
DIV = {int(k): v for k, v in D['cost']['divisor'].items()}

def base_cost(L, s, mult22=1.0):
    if s < 10:
        c = 1000 + L**3 * (s + 1) / 36
    else:
        c = 1000 + L**3 * (s + 1) ** 2.7 / DIV[s]
    c = round(c / 100) * 100  # 100メル単位(四捨五入)
    if s >= 22:
        c = round(c * mult22)
    return c

def probs(s, catch=True, destroy_down30=False, guarantee51015=False):
    p, k, d = D['probabilityBase']['table'][s]
    if guarantee51015 and s in (5, 10, 15):
        return 1.0, 0.0, 0.0
    if destroy_down30 and s <= 21 and d > 0:
        k, d = k + d * 0.3, d * 0.7
    if catch:
        p2 = min(1.0, p * 1.05)
        rest = 1 - p2
        tot = k + d
        if tot > 0:
            k, d = rest * k / tot, rest * d / tot
        p = p2
    return p, k, d

def attempt_cost(L, s, opt):
    c = base_cost(L, s, opt.get('mult22', 1.0))
    disc = 1.0
    if opt.get('discount30'):
        disc *= 0.7
    vip = opt.get('vipRate', 0.0)
    if vip and s <= 16:
        disc *= (1 - vip)
    total = c * disc
    if s in opt.get('safeguard', []) and s in (15, 16, 17):
        total += c * 2.0  # 破壊防止加算(割引対象外)
    return total

def restore(L, s, opt):
    """破壊時: (復旧後の★, 復旧コスト)"""
    spare = opt.get('sparePrice', 0)
    if opt.get('destroyMode', 'restorePrev') == 'restart12':
        return 12, spare
    t = min(s, 22)
    cnt = next(x['count'] for x in D['destruction']['restoreSpares'] if t <= x['maxStar'])
    ratio = D['destruction']['restoreMesoRatio'].get(str(t), 0)
    return t, ratio * base_cost(L, t) + cnt * spare

def expected(L, a, b, **opt):
    """a→b の期待メルと期待破壊回数。E[s] = sから b まで。後ろから解く連立(破壊で戻る先がs以下なので反復で解く)。"""
    # 状態 a..b-1 の期待値を 価値反復で求める(収束まで)。12再開で a<12 の状態が必要になる場合も含める
    lo = min(a, 12) if opt.get('destroyMode') == 'restart12' else a
    E = {s: 0.0 for s in range(lo, b + 1)}
    N = {s: 0.0 for s in range(lo, b + 1)}
    # 解析解: 前から順に「s→s+1 の期待コスト」を作る(破壊後の戻り先 r(s) ≤ s のため)
    step = {}; stepD = {}
    for s in range(lo, b):
        p, k, d = probs(s, opt.get('catch', True), opt.get('destroyDown30', False), opt.get('guarantee51015', False))
        if s in opt.get('safeguard', []) and s in (15, 16, 17):
            k, d = k + d, 0.0
        c = attempt_cost(L, s, opt)
        if d > 0:
            r, rc = restore(L, s, opt)
            back = sum(step[t] for t in range(r, s))  # r→s に戻るコスト
            backD = sum(stepD[t] for t in range(r, s))
            # x = c + d*(rc + back + x) + k*x  → x = (c + d*(rc+back)) / p
            step[s] = (c + d * (rc + back)) / p
            stepD[s] = (d * (1 + backD)) / p
        else:
            step[s] = c / p
            stepD[s] = 0.0
    return sum(step[s] for s in range(a, b)), sum(stepD[s] for s in range(a, b))

if __name__ == '__main__':
    out = {'perAttempt': {}, 'cases': []}
    for L in (130, 140, 150, 160, 200, 250):
        out['perAttempt'][L] = [base_cost(L, s) for s in range(30)]
    ref = D['cost']['referencePerAttempt']
    bad = [(L, s) for L in ref for s in range(30) if abs(out['perAttempt'][int(L)][s] - ref[L][s]) > 100]
    print('perAttempt mismatch vs research table:', bad[:10])
    cases = [
        dict(L=150, a=0, b=17), dict(L=160, a=17, b=22), dict(L=200, a=17, b=22), dict(L=200, a=12, b=22),
        dict(L=200, a=22, b=25), dict(L=250, a=17, b=22),
    ]
    for c in cases:
        for mode in ('restart12', 'restorePrev'):
            m, d = expected(c['L'], c['a'], c['b'], destroyMode=mode)
            out['cases'].append({**c, 'destroyMode': mode, 'sparePrice': 0, 'expectedMel': round(m), 'expectedDestroy': round(d, 4)})
    # イベント・破壊防止・VIP の組合せ
    for opt in (dict(discount30=True), dict(destroyDown30=True), dict(safeguard=[15, 16, 17]), dict(vipRate=0.05), dict(mult22=1.2)):
        m, d = expected(200, 15, 23, destroyMode='restorePrev', **opt)
        out['cases'].append({'L': 200, 'a': 15, 'b': 23, 'destroyMode': 'restorePrev', **opt, 'expectedMel': round(m), 'expectedDestroy': round(d, 4)})
    for r in D['referenceExpected']['rows']:
        m, d = expected(r['L'], r['from'], r['to'], destroyMode='restart12')
        print('research ref', r['L'], r['from'], r['to'], 'mine', round(m), round(d, 3), 'ref', r['meso'], r['destroy'])
    json.dump(out, open(os.path.join(os.path.dirname(__file__), 'starforce_expected.json'), 'w'), indent=1)
    for c in out['cases']: print(c)
