// 静的マスタ(public/data/*.json)の zod スキーマ。DESIGN.md §4.1「zod で最低限の形を検証」。
// 計算で使うフィールドは厳しめに、メタ情報・注記は緩く(passthrough)検証する。
import { z } from 'zod';

const num = z.number().finite();
const numArray = z.array(num);
const numRecord = z.record(num);
const statKey = z.enum(['STR', 'DEX', 'INT', 'LUK']);
const grade = z.enum(['rare', 'epic', 'unique', 'legendary']);
const tierUpGrades = z.object({ rare: num, epic: num, unique: num }).passthrough();
const looseMeta = z.object({}).passthrough();

// ---------------------------------------------------------------- starforce.json
export const starforceSchema = z
  .object({
    meta: looseMeta,
    maxStarByLevel: z.array(z.object({ maxLv: num, star: num }).passthrough()).min(1),
    probabilityBase: z
      .object({ table: z.array(z.tuple([num, num, num])).min(1) })
      .passthrough(),
    starCatch: z.object({ defaultOn: z.boolean(), successMultiplier: num }).passthrough(),
    cost: z
      .object({
        divisor: numRecord,
        jmsStar22PlusMultiplier: z.object({ default: num, alt: num }).passthrough(),
      })
      .passthrough(),
    safeguard: z.object({ stars: numArray, surchargeRate: num }).passthrough(),
    discounts: z
      .object({
        vip: z
          .object({
            rates: z
              .object({ none: num, silver: num, gold: num, diamond: num, royal: num })
              .passthrough(),
            maxCurrentStar: num,
          })
          .passthrough(),
      })
      .passthrough(),
    events: z
      .object({
        discount30: z.object({ costMultiplier: num }).passthrough(),
        destroyDown30: z.object({ maxCurrentStar: num, destroyMultiplier: num }).passthrough(),
        guarantee51015: z.object({ stars: numArray }).passthrough(),
        plusOneUnder10: z.object({ maxCurrentStar: num }).passthrough(),
      })
      .passthrough(),
    destruction: z
      .object({
        defaultMode: z.enum(['restorePrev', 'restart12']),
        traceCapFrom: num,
        traceCapStar: num,
        basicRestoreStar: num,
        restoreSpares: z.array(z.object({ maxStar: num, count: num }).passthrough()),
        restoreMesoRatio: numRecord,
      })
      .passthrough(),
    stats: z
      .object({
        levelBands: z
          .array(
            z
              .object({ minLv: num, key: z.enum(['130', '140', '150', '160', '200', '250']) })
              .passthrough(),
          )
          .min(1),
        statCumulative1to15: numArray.length(15),
        statCumulative16: z.record(numArray),
        armorAttCumulative16: z.record(numArray),
        weaponAttCumulative16: z.record(numArray),
        gloveAttStars: numArray,
      })
      .passthrough(),
  })
  .passthrough();

// ---------------------------------------------------------------- cubes.json
const cubeDefSchema = z
  .object({
    id: z.enum(['neo', 'mega', 'neoAdditional', 'megaAdditional']),
    nameJa: z.string(),
    target: z.enum(['potential', 'additional']),
    itemIdIcon: num,
    kmsEquivalent: z.enum(['red', 'black', 'additional']),
    confidence: z.string(),
    maxGrade: grade,
    tierUp: tierUpGrades,
    guarantee: tierUpGrades,
    canKeepOld: z.boolean(),
    defaultPriceNP: num,
    defaultEnabled: z.boolean().optional(),
  })
  .passthrough();

export const cubesSchema = z
  .object({
    meta: looseMeta,
    currency: z.object({ melPerNPDefault: num }).passthrough(),
    cubes: z.array(cubeDefSchema).min(1),
    events: z
      .object({
        miracleTime: z
          .object({
            label: z.string(),
            tierUpMultiplier: num,
            appliesTo: z.array(z.string()),
          })
          .passthrough(),
      })
      .passthrough(),
    gradeOrder: z.array(grade),
  })
  .passthrough();

// ---------------------------------------------------------------- potential/kms-cube-tables.json
const optionKey = z.enum([
  'statPct',
  'statFlat',
  'allStatPct',
  'allStatFlat',
  'statPerLv',
  'attPct',
  'mattPct',
  'attFlat',
  'mattFlat',
  'attPerLv',
  'mattPerLv',
  'dmgPct',
  'bossPct',
  'iedPct',
  'critRate',
  'critDmg',
  'cdrSec',
  'hpPct',
  'hpFlat',
  'mpPct',
  'mpFlat',
  'mesoPct',
  'dropPct',
  'other',
]);

const potOptionSchema = z
  .object({
    id: num,
    key: optionKey,
    stat: statKey.optional(),
    value: num,
    per: num.optional(),
    ja: z.string(),
    kr: z.string(),
    group: z.enum(['maxOne', 'maxTwo']).nullable(),
  })
  .passthrough();

export const cubeTablesSchema = z
  .object({
    meta: looseMeta,
    options: z.array(potOptionSchema),
    lineDists: z.array(z.array(z.tuple([num, num]))),
    tables: z.record(
      z.array(
        z
          .object({ minLv: num, lines: z.tuple([num, num, num]).nullable() })
          .passthrough(),
      ),
    ),
  })
  .passthrough();

// ---------------------------------------------------------------- flame.json
export const flameSchema = z
  .object({
    meta: looseMeta,
    flames: z.record(looseMeta),
    tierProbBase_1to5: z.record(numArray),
    bossTierBonus: num,
    lineCountProb: z.record(numRecord),
    optionSelection: looseMeta,
    optionPools: z.object({ weapon: z.array(z.string()), armor: z.array(z.string()) }).passthrough(),
    levelRestrictions: z.object({ weapon: numRecord, armor: numRecord }).passthrough(),
    bossItems: z
      .object({ examples: z.array(z.string()), nonBossExceptions: z.array(z.string()) })
      .passthrough(),
    eligibility: z
      .object({
        noFlame: z.array(z.string()),
        exceptionsCanFlame: z.array(z.string()),
        canFlame: z.array(z.string()),
      })
      .passthrough(),
    scoreWeightsDefault: z
      .object({ main: num, sub: num, att: num, allStatP: num })
      .passthrough(),
  })
  .passthrough();

// ---------------------------------------------------------------- jobs.json
const jobStatKey = z.enum(['STR', 'DEX', 'INT', 'LUK', 'HP']);

export const jobsSchema = z
  .object({
    _meta: looseMeta,
    jobs: z
      .array(
        z
          .object({
            id: z.string().min(1),
            nameJa: z.string(),
            kmsName: z.string(),
            branch: z.string(),
            category: z.string(),
            mainStat: z.array(jobStatKey).min(1),
            subStat: z.array(jobStatKey),
            attackType: z.enum(['att', 'matt']),
            statFormula: z.enum(['standard', 'xenon', 'demonAvenger']),
            weaponMultiplier: num.nullable(),
            avgCdrSecKMS: num.nullable(),
            cdrLinesPer2Sec: num,
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

// ---------------------------------------------------------------- items.json
const flag = z.union([z.literal(0), z.literal(1)]);

export const itemSchema = z
  .object({
    id: num,
    name: z.string(),
    lv: num,
    slot: z.enum([
      'hat',
      'top',
      'bottom',
      'overall',
      'shoes',
      'gloves',
      'cape',
      'belt',
      'shoulder',
      'face',
      'eye',
      'earrings',
      'ring',
      'pendant',
      'emblem',
      'pocket',
      'shield',
      'secondary',
      'weapon',
    ]),
    sub: z.string(),
    jobs: z.array(z.string()),
    boss: flag,
    superior: flag,
    setId: num.nullable(),
    setName: z.string().nullable(),
    tuc: num,
    onlyUpgrade: flag,
    exceptUpgrade: flag,
    noPotential: flag,
    base: z
      .object({ str: num, dex: num, int: num, luk: num, att: num, matt: num, hp: num })
      .passthrough(),
  })
  .passthrough();

export const itemsSchema = z
  .object({
    meta: z.object({ source: z.string(), asOf: z.string(), minLevel: num }).passthrough(),
    items: z.array(itemSchema),
  })
  .passthrough();

// ---------------------------------------------------------------- manifest.json
export const manifestSchema = z
  .object({
    version: z.string().min(1),
    generatedAt: z.string(),
    files: z.record(
      z.object({ sha: z.string(), bytes: num, asOf: z.string().nullable() }).passthrough(),
    ),
  })
  .passthrough();

/** zod のエラーを「パス: メッセージ」の行にまとめる(先頭 maxIssues 件) */
export function describeZodError(err: z.ZodError, maxIssues = 5): string {
  const lines = err.issues
    .slice(0, maxIssues)
    .map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`);
  const rest = err.issues.length - lines.length;
  if (rest > 0) lines.push(`…ほか ${rest} 件`);
  return lines.join('\n');
}
