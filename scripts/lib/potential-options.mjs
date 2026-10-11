// KMS公式キューブ確率表の「オプション文言(韓国語)」を、アプリ内部キー + 日本語表示名に正規化する。
// fetch-kms-cube-tables.mjs と build-seed.mjs の両方から使う。
// 返り値: { key, stat?, value, per?, ja, kr }
//   key 一覧:
//     statPct, statFlat, allStatPct, allStatFlat, statPerLv,
//     attPct, mattPct, attFlat, mattFlat, attPerLv, mattPerLv,
//     dmgPct, bossPct, iedPct, critRate, critDmg, cdrSec,
//     hpPct, hpFlat, mpPct, mpFlat, mesoPct, dropPct, other

const STAT_JA = { STR: 'STR', DEX: 'DEX', INT: 'INT', LUK: 'LUK' };

const RULES = [
  // 9レベル(10レベル)ごとの主ステ・攻撃力
  [/^캐릭터 기준 (\d+)레벨 당 (STR|DEX|INT|LUK) \+(\d+)$/, (m) => ({ key: 'statPerLv', stat: m[2], per: +m[1], value: +m[3], ja: `キャラクターレベル${m[1]}ごとに${STAT_JA[m[2]]} : +${m[3]}` })],
  [/^캐릭터 기준 (\d+)레벨 당 공격력 \+(\d+)$/, (m) => ({ key: 'attPerLv', per: +m[1], value: +m[2], ja: `キャラクターレベル${m[1]}ごとに攻撃力 : +${m[2]}` })],
  [/^캐릭터 기준 (\d+)레벨 당 마력 \+(\d+)$/, (m) => ({ key: 'mattPerLv', per: +m[1], value: +m[2], ja: `キャラクターレベル${m[1]}ごとに魔力 : +${m[2]}` })],
  [/^(STR|DEX|INT|LUK) \+(\d+)%$/, (m) => ({ key: 'statPct', stat: m[1], value: +m[2], ja: `${m[1]} : +${m[2]}%` })],
  [/^(STR|DEX|INT|LUK) \+(\d+)$/, (m) => ({ key: 'statFlat', stat: m[1], value: +m[2], ja: `${m[1]} : +${m[2]}` })],
  [/^올스탯 \+(\d+)%$/, (m) => ({ key: 'allStatPct', value: +m[1], ja: `全ステータス : +${m[1]}%` })],
  [/^올스탯 \+(\d+)$/, (m) => ({ key: 'allStatFlat', value: +m[1], ja: `全ステータス : +${m[1]}` })],
  [/^공격력 \+(\d+)%$/, (m) => ({ key: 'attPct', value: +m[1], ja: `攻撃力 : +${m[1]}%` })],
  [/^마력 \+(\d+)%$/, (m) => ({ key: 'mattPct', value: +m[1], ja: `魔力 : +${m[1]}%` })],
  [/^공격력 \+(\d+)$/, (m) => ({ key: 'attFlat', value: +m[1], ja: `攻撃力 : +${m[1]}` })],
  [/^마력 \+(\d+)$/, (m) => ({ key: 'mattFlat', value: +m[1], ja: `魔力 : +${m[1]}` })],
  [/^데미지 \+(\d+)%$/, (m) => ({ key: 'dmgPct', value: +m[1], ja: `ダメージ : +${m[1]}%` })],
  [/^보스 몬스터 (?:공격 시 )?데미지 \+(\d+)%$/, (m) => ({ key: 'bossPct', value: +m[1], ja: `ボスモンスター攻撃時のダメージ : +${m[1]}%` })],
  [/^몬스터 방어율 무시 \+(\d+)%$/, (m) => ({ key: 'iedPct', value: +m[1], ja: `モンスター防御率無視 : +${m[1]}%` })],
  [/^크리티컬 확률 \+(\d+)%$/, (m) => ({ key: 'critRate', value: +m[1], ja: `クリティカル率 : +${m[1]}%` })],
  [/^크리티컬 데미지 \+(\d+)%$/, (m) => ({ key: 'critDmg', value: +m[1], ja: `クリティカルダメージ : +${m[1]}%` })],
  [/^스킬 재사용 대기시간 -(\d+)초/, (m) => ({ key: 'cdrSec', value: +m[1], ja: `全スキルの再使用待機時間 : -${m[1]}秒` })],
  [/^최대 HP \+(\d+)%$/, (m) => ({ key: 'hpPct', value: +m[1], ja: `最大HP : +${m[1]}%` })],
  [/^최대 HP \+(\d+)$/, (m) => ({ key: 'hpFlat', value: +m[1], ja: `最大HP : +${m[1]}` })],
  [/^최대 MP \+(\d+)%$/, (m) => ({ key: 'mpPct', value: +m[1], ja: `最大MP : +${m[1]}%` })],
  [/^최대 MP \+(\d+)$/, (m) => ({ key: 'mpFlat', value: +m[1], ja: `最大MP : +${m[1]}` })],
  [/^메소 획득량 \+(\d+)%$/, (m) => ({ key: 'mesoPct', value: +m[1], ja: `メル獲得量 : +${m[1]}%` })],
  [/^아이템 드롭률 \+(\d+)%$/, (m) => ({ key: 'dropPct', value: +m[1], ja: `アイテムドロップ率 : +${m[1]}%` })],
];

// 「使える○○」スキル名の和訳(表示用)
const SKILL_JA = {
  '미스틱 도어': 'ミスティックドア',
  '하이퍼 바디': 'ハイパーボディ',
  '헤이스트': 'ヘイスト',
  '샤프 아이즈': 'シャープアイズ',
  '어드밴스드 블레스': 'アドバンスドブレス',
  '컴뱃 오더스': 'コンバットオーダー',
  '윈드 부스터': 'ウィンドブースター',
};

// 「その他」行の簡易和訳(表示用。計算には使わない)
const OTHER_JA = [
  [/^방어력 \+(\d+)%$/, (m) => `防御力 : +${m[1]}%`],
  [/^방어력 \+(\d+)$/, (m) => `防御力 : +${m[1]}`],
  [/^이동속도 \+(\d+)$/, (m) => `移動速度 : +${m[1]}`],
  [/^점프력 \+(\d+)$/, (m) => `ジャンプ力 : +${m[1]}`],
  [/^모든 스킬의 MP 소모 -(\d+)%$/, (m) => `全スキルのMP消費量 : -${m[1]}%`],
  [/^HP 회복 아이템 및 회복 스킬 효율 \+(\d+)%$/, (m) => `HP回復アイテムと回復スキルの効率 : +${m[1]}%`],
  [/^피격 후 무적시간 \+(\d+)초$/, (m) => `被撃後の無敵時間 : +${m[1]}秒`],
  [/^피격 시 (\d+)% 확률로 (\d+)초간 무적$/, (m) => `被撃時${m[1]}%の確率で${m[2]}秒間無敵`],
  [/^피격 시 (\d+)% 확률로 데미지의 (\d+)% 무시$/, (m) => `被撃時${m[1]}%の確率でダメージの${m[2]}%を無視`],
  [/^(\d+)% 확률로 받은 피해의 (\d+)%를 반사$/, (m) => `${m[1]}%の確率で受けたダメージの${m[2]}%を反射`],
  [/^공격 시 (\d+)% 확률로 (\d+)의 HP 회복$/, (m) => `攻撃時${m[1]}%の確率でHP${m[2]}回復`],
  [/^공격 시 (\d+)% 확률로 (\d+)의 MP 회복$/, (m) => `攻撃時${m[1]}%の確率でMP${m[2]}回復`],
  [/^몬스터 처치 시 (\d+)% 확률로 (\d+)의 HP 회복$/, (m) => `モンスター討伐時${m[1]}%の確率でHP${m[2]}回復`],
  [/^몬스터 처치 시 (\d+)% 확률로 (\d+)의 MP 회복$/, (m) => `モンスター討伐時${m[1]}%の確率でMP${m[2]}回復`],
  [/^공격 시 (\d+)% 확률로 (\d+)레벨 (중독|기절|슬로우|암흑|빙결|봉인)효과 적용$/, (m) => `攻撃時${m[1]}%の確率でLv${m[2]}の${{ 중독: '毒', 기절: 'スタン', 슬로우: 'スロー', 암흑: '暗闇', 빙결: '凍結', 봉인: '封印' }[m[3]]}効果`],
  [/^<쓸만한 (.+)> 스킬 사용 가능$/, (m) => `<使える${SKILL_JA[m[1]] ?? m[1]}>スキル使用可能`],
];

// 1つの行に同時に出られる数の制限(KMS公式 "대상 장비에 따른 옵션")
//   maxOne : 3行中最大1行  (쓸만한 스킬系, 피격 후 무적시간)
//   maxTwo : 3行中最大2行  (피격 시 데미지 무시, 피격 시 무적)
export function restrictionGroup(kr) {
  if (/^<쓸만한 /.test(kr) || /^피격 후 무적시간/.test(kr)) return 'maxOne';
  if (/^피격 시 \d+% 확률로 데미지의/.test(kr) || /^피격 시 \d+% 확률로 \d+초간 무적/.test(kr)) return 'maxTwo';
  return null;
}

export function normalizeOption(kr) {
  const s = kr.trim();
  for (const [re, f] of RULES) {
    const m = s.match(re);
    if (m) return { ...f(m), kr: s };
  }
  for (const [re, f] of OTHER_JA) {
    const m = s.match(re);
    if (m) return { key: 'other', value: 0, ja: f(m), kr: s };
  }
  return { key: 'other', value: 0, ja: s, kr: s }; // 未翻訳(韓国語のまま表示)
}

// KMS公式サイトの部位コード → アプリの部位キー
export const PART_CODES = {
  1: 'weapon', 2: 'emblem', 3: 'secondary', 4: 'forceShield', 5: 'shield',
  6: 'hat', 7: 'top', 8: 'overall', 9: 'bottom', 10: 'shoes', 11: 'gloves', 12: 'cape',
  13: 'belt', 14: 'shoulder', 15: 'face', 16: 'eye', 17: 'earrings', 18: 'ring', 19: 'pendant',
};
export const GRADE_CODES = { 1: 'rare', 2: 'epic', 3: 'unique', 4: 'legendary' };
// KMS公式のキューブID(確率表の取得キー) → アプリのキューブ確率キー
export const CUBE_CODES = { red: '5062009', black: '5062010', additional: '5062500' };
