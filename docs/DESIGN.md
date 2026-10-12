# JMS 装備強化順序プランナー 詳細設計書

- 版: v1.0(2026-10-12)
- 対象: 日本版メイプルストーリー(JMS)。個人利用。GitHub Pages で配信する静的Webアプリ。
- 元にしたもの: msuplanner.com の「スペックアップ」タブ(スペックアップの順番・追加オプションの順番)。分析メモは `docs/research/00_msu_site_analysis.md`。

---

## 0. 目的とスコープ

### 0.1 目的
手動で入力したキャラクターと装備の現状から、**次にどの装備をどう強化すると、かけたメルに対して戦闘力が最も伸びるか**を順番に並べて表示する。

### 0.2 作るもの(v1)
| # | 機能 | 内容 |
|---|---|---|
| F1 | キャラクター・装備の手動入力 | 職業、Lv、表示戦闘力、ステータス、各部位の装備(アイテム、★、潜在、アディ、追加オプション) |
| F2 | スペックアップの順番 | スターフォース・潜在・アディショナルの全ステップを「戦闘力上昇 ÷ 期待コスト(メル)」の順に並べたグリッド。詳細ポップオーバー |
| F3 | 追加オプションの順番 | 転生の炎1個あたりの期待戦闘力上昇が高い順に装備を並べたグリッド |
| F4 | 強化オプション(設定) | スターキャッチ、イベント、VIP割引、破壊の扱い、破壊防止、キューブの有効/価格、メル換算レート、帽子クール減の価値 など |
| F5 | データ保存 | ブラウザ(localStorage)に保存。JSONで書き出し・読み込み。複数キャラ |

### 0.3 作らないもの
キューブコスト一覧タブ、シードリング、強化シミュレーター、お気に入り(仮想強化)、相場チャート、キャラ検索/API連携、多言語、共有URL、ランキング。

### 0.4 方針
- **確率・費用など JMS で公開されていない値は KMS 公式値を使う**。各値の出典と確度はデータファイルの `meta` / `confidence` に持つ。
- 不確かな値は**設定で上書きできる**ようにし、画面の「計算方法」に前提を明記する。
- 通貨は**メル**(JMSの通貨名)。キューブ等の課金アイテムは NEXONポイント(NP)単価 × メル換算レートでメルに直す。換算レートはメルマーケットの相場(1億メルあたりのメイプルポイント数)から 1NPあたりのメル = 1億 ÷ ポイント数 として求める(1メイプルポイント = 1NP とみなす)。
- 画面は日本語のみ。

---

## 1. 技術構成

| 項目 | 採用 | 理由 |
|---|---|---|
| ビルド | Vite 6 | 静的出力、`base` 設定で GitHub Pages のサブパスに対応 |
| UI | React 18 + TypeScript 5(strict) | |
| スタイル | Tailwind CSS 3 | ダーク/ライト切替を `class` 戦略で |
| 状態管理 | Zustand 4 + `persist` ミドルウェア(localStorage) | |
| 入力検証 | zod 3 | 読み込みJSONとlocalStorageの検証・移行 |
| 重い計算 | Web Worker(Vite の `?worker`)+ Comlink 4 | 炎の分布計算・候補生成をメインスレッドから外す |
| テスト | Vitest 2(単体)、Playwright(任意のスモーク) | |
| Lint | ESLint 9 + Prettier 3 | |
| 配信 | GitHub Pages(GitHub Actions でビルド・デプロイ) | |

- 実行時に外部サーバーへは一切リクエストしない(データ・アイコンはすべて同一オリジンの静的ファイル)。
- Node 20 以上。パッケージのバージョンは `package.json` で固定(`^` ではなく正確なバージョン)。

---

## 2. リポジトリ構成

```
jms-planner/
├─ index.html
├─ vite.config.ts            # base は環境変数 VITE_BASE(既定 '/jms-planner/')
├─ package.json
├─ public/
│  ├─ robots.txt             # Disallow: /(検索避け)
│  ├─ data/                  # 静的マスタ(§4.1)。アプリは fetch で読む
│  │  ├─ manifest.json       # 各ファイルの version / asOf / sha256(ビルド時生成)
│  │  ├─ starforce.json
│  │  ├─ cubes.json
│  │  ├─ flame.json
│  │  ├─ jobs.json
│  │  ├─ items.json          # scripts/fetch-jms-items.mjs で生成
│  │  └─ potential/kms-cube-tables.json
│  └─ icons/
│     ├─ items/{id}.png      # scripts/fetch-icons.mjs で生成
│     └─ ui/*.png
├─ scripts/                  # データ生成(開発者の手元で実行。CIでは実行しない)
│  ├─ fetch-kms-cube-tables.mjs
│  ├─ build-seed-cube-tables.mjs
│  ├─ fetch-jms-items.mjs
│  ├─ fetch-icons.mjs
│  ├─ build-manifest.mjs     # public/data/manifest.json を作る(prebuild で実行)
│  └─ lib/potential-options.mjs
├─ src/
│  ├─ main.tsx / App.tsx
│  ├─ data/                  # マスタの型・ローダー・索引
│  │  ├─ types.ts
│  │  ├─ loader.ts
│  │  └─ indexes.ts
│  ├─ domain/                # 純粋関数のみ(React非依存)。テスト対象の中心
│  │  ├─ character.ts        # 入力型(§5)
│  │  ├─ cp.ts               # 戦闘力モデル(§6.1)
│  │  ├─ starforce.ts        # ★の上昇量・費用・期待値(§6.2)
│  │  ├─ potential.ts        # 潜在/アディの候補生成と確率(§6.3)
│  │  ├─ flame.ts            # 炎の分布と効率(§6.4)
│  │  ├─ planner.ts          # 強化順序(§6.5)
│  │  └─ money.ts            # 通貨換算・表示
│  ├─ worker/plan.worker.ts  # planner と flame を Worker で実行
│  ├─ store/                 # Zustand(characters, settings, ui)
│  ├─ components/            # 画面(§7)
│  └─ styles/
├─ tests/
│  ├─ reference/             # Python参照実装と期待値JSON(同梱)
│  └─ unit/*.test.ts
└─ .github/workflows/deploy.yml
```

---

## 3. 用語

| 用語 | 意味 |
|---|---|
| ステップ | 強化順序の1マス。「装備X の ★a→b」「装備X の潜在を 目標T にする」など |
| 期待コスト | そのステップを達成するまでに使うメルの期待値(破壊・失敗・キューブの外れを含む平均) |
| 効率 | 戦闘力上昇 ÷ 期待コスト。順序付けの基準 |
| 主ステ / 副ステ | 職業のメインステータス / サブステータス(`jobs.json`) |
| レジェ主ステ行 | その装備のレジェンダリー潜在で出る主ステ%の最大値(例 Lv200以下 12%、201以上 13%) |
| 帯(band) | KMS確率表の装備Lv区間。`minLv` 以上〜次の帯の `minLv` 未満 |

---

## 4. データ設計

### 4.1 静的マスタ(`public/data/`)

アプリ起動時に `fetch(`${import.meta.env.BASE_URL}data/xxx.json`)` で読む。`manifest.json` の `version` をクエリ(`?v=`)に付けてキャッシュを更新する。読み込みは `src/data/loader.ts` に集約し、zod で最低限の形を検証する。

| ファイル | 生成方法 | 主な中身 | サイズ目安 |
|---|---|---|---|
| `starforce.json` | 同梱(調査済み) | Lv別最大★、各★の確率、費用式の除数、スターキャッチ、破壊防止、VIP、イベント、破壊時の復旧、★ごとの上昇量表 | 20KB |
| `cubes.json` | 同梱 | JMSキューブ(ネオ/メガ/ネオアディ/メガアディ)と KMS 確率表の対応、等級上昇確率、上昇保証回数、初期価格(NP) | 5KB |
| `potential/kms-cube-tables.json` | 同梱シード → `fetch-kms-cube-tables.mjs` で完全版に更新 | KMS公式の行別オプション確率(レッド/ブラック/エディショナル × 等級 × 部位 × Lv帯) | シード100KB / 完全版 約0.5〜1MB |
| `flame.json` | 同梱 | 炎の種類、段階確率、行数確率、候補オプション、数値式、対象外装備 | 10KB |
| `jobs.json` | 同梱 | 50職: 日本語名、主ステ/副ステ、攻撃力/魔力、ステ計算式種別、帽子クール減の価値(既定) | 15KB |
| `items.json` | `fetch-jms-items.mjs` で生成 | JMS装備(Lv100以上): ID、日本語名、Lv、部位、職業、ボス報酬フラグ、シュペリアル、セット、基本ステ・攻撃力 | 約0.6MB |
| `manifest.json` | `build-manifest.mjs`(prebuild) | 各ファイルの `asOf`、`sha256` 先頭8桁、アプリ用 `version` | 1KB |

#### 4.1.1 型(`src/data/types.ts`)

```ts
// ---- starforce.json ----
export interface StarforceMaster {
  maxStarByLevel: { maxLv: number; star: number }[];          // 昇順。最初に maxLv>=装備Lv となる要素
  probabilityBase: { table: [success: number, keep: number, destroy: number][] }; // index=現在★(0..29)
  starCatch: { defaultOn: boolean; successMultiplier: number };
  cost: { divisor: Record<string, number>; jmsStar22PlusMultiplier: { default: number; alt: number } };
  safeguard: { stars: number[]; surchargeRate: number };      // [15,16,17], 2.0
  discounts: { vip: { rates: Record<VipRank, number>; maxCurrentStar: number } };
  events: {
    discount30: { costMultiplier: number };
    destroyDown30: { maxCurrentStar: number; destroyMultiplier: number };
    guarantee51015: { stars: number[] };
    plusOneUnder10: { maxCurrentStar: number };
  };
  destruction: {
    defaultMode: 'restorePrev' | 'restart12';
    traceCapFrom: number; traceCapStar: number; basicRestoreStar: number;
    restoreSpares: { maxStar: number; count: number }[];
    restoreMesoRatio: Record<string, number>;                 // 復旧メル = ratio[t] × 基本1回費用(L, t)
  };
  stats: {
    levelBands: { minLv: number; key: '130'|'140'|'150'|'160'|'200'|'250' }[];
    statCumulative1to15: number[];                            // 15要素。★k までの累積(STR/DEX/INT/LUK 各)
    statCumulative16: Record<string, number[]>;              // ★16..22 の累積(帯別)。★23以上は増えない
    armorAttCumulative16: Record<string, number[]>;          // ★16..30 の累積攻撃力/魔力(防具・アクセ)
    weaponAttCumulative16: Record<string, number[]>;         // ★16..   の累積(武器)。欠けている段階は未確定→計算対象外
    gloveAttStars: number[];                                 // [5,7,9,11,13,14,15] で攻撃力/魔力+1
  };
}
export type VipRank = 'none' | 'silver' | 'gold' | 'diamond' | 'royal';

// ---- potential/kms-cube-tables.json ----
export type OptionKey = 'statPct'|'statFlat'|'allStatPct'|'allStatFlat'|'statPerLv'|'attPct'|'mattPct'|'attFlat'|'mattFlat'
  |'attPerLv'|'mattPerLv'|'dmgPct'|'bossPct'|'iedPct'|'critRate'|'critDmg'|'cdrSec'|'hpPct'|'hpFlat'|'mpPct'|'mpFlat'
  |'mesoPct'|'dropPct'|'other';
export interface PotOption { id: number; key: OptionKey; stat?: 'STR'|'DEX'|'INT'|'LUK'; value: number; per?: number;
  ja: string; kr: string; group: 'maxOne' | 'maxTwo' | null; }
export interface CubeTables {
  meta: { asOf: string; seed?: boolean; note: string };
  options: PotOption[];
  lineDists: [optionId: number, percent: number][][];        // 1行分の分布(%表記。合計100)
  tables: Record<`${'red'|'black'|'additional'}/${Grade}/${Part}`, { minLv: number; lines: [number, number, number] | null }[]>;
}
export type Grade = 'rare'|'epic'|'unique'|'legendary';
export type Part = 'weapon'|'emblem'|'secondary'|'forceShield'|'shield'|'hat'|'top'|'overall'|'bottom'|'shoes'|'gloves'
  |'cape'|'belt'|'shoulder'|'face'|'eye'|'earrings'|'ring'|'pendant';

// ---- cubes.json ----
export interface CubeDef { id: 'neo'|'mega'|'neoAdditional'|'megaAdditional'; nameJa: string; target: 'potential'|'additional';
  kmsEquivalent: 'red'|'black'|'additional'; tierUp: Record<'rare'|'epic'|'unique', number>;
  guarantee: Record<'rare'|'epic'|'unique', number>; canKeepOld: boolean; defaultPriceNP: number; defaultEnabled?: boolean;
  itemIdIcon: number; confidence: string; }

// ---- items.json ----
export interface ItemMaster { id: number; name: string; lv: number; slot: EquipSlotKind; sub: string; jobs: string[];
  boss: 0|1; superior: 0|1; setId: number|null; setName: string|null; tuc: number; onlyUpgrade: 0|1; exceptUpgrade: 0|1;
  noPotential: 0|1; base: { str: number; dex: number; int: number; luk: number; att: number; matt: number; hp: number }; }
export type EquipSlotKind = 'hat'|'top'|'bottom'|'overall'|'shoes'|'gloves'|'cape'|'belt'|'shoulder'|'face'|'eye'
  |'earrings'|'ring'|'pendant'|'emblem'|'pocket'|'shield'|'secondary'|'weapon';
```

`flame.json` と `jobs.json` は同梱ファイルのキー構成をそのまま型にする(`docs/research/30_flame.md` §7.1、`docs/research/40_character_cp.md` §7.1 参照)。

#### 4.1.2 索引(`src/data/indexes.ts`)
- `itemsById: Map<number, ItemMaster>`、`itemsBySlot: Map<EquipSlotKind, ItemMaster[]>`(名前の正規化済み文字列も保持。ひらがな/カタカナ・全角半角を同一視して部分一致検索)。
- `cubeTable(cubeKey, grade, part, lv)`: 該当帯を返す。**表が無いとき**(シード版で red や一部部位が無い)のフォールバック順: `red→black`、`overall→top`、`shield/forceShield→secondary`。フォールバックしたら UI に「⚠ 確率表を代用中」を出す。
- `potentialOptionsFor(cubeKey, grade, part, lv)`: その表の3行に出うるオプションの和集合(入力フォームの選択肢)。

### 4.2 ユーザーデータ(localStorage)

| キー | 中身 |
|---|---|
| `jmsplanner:v1:characters` | `{ activeId, characters: Record<id, CharacterInput> }` |
| `jmsplanner:v1:settings` | `PlannerSettings`(§5.3)。キャラ共通 |
| `jmsplanner:v1:ui` | テーマ(dark/light)、開いているタブ、折りたたみ状態 |

- すべて `version` を持ち、zod スキーマで検証。読めないときは**壊さずに**退避キー(`...:backup:{timestamp}`)へ移してから初期化し、トーストで知らせる。
- 読み書きは try/catch で包む(プライベートウィンドウ等で失敗しても画面は動く)。
- **JSON書き出し/読み込み**: キャラ1件または全件。ファイル名 `jms-planner-{キャラ名}-{YYYYMMDD}.json`。読み込み時は zod 検証 → 差分プレビュー → 上書き/別名で追加。
- キャラデータはリポジトリにコミットしない(GitHub Pages は公開URLになるため)。

### 4.3 画像
- 装備アイコン: `public/icons/items/{id}.png`(`scripts/fetch-icons.mjs` で maplestory.io から取得。約3,800枚・数MB)。`<img loading="lazy" width=32 height=32>`。404 時は部位別のプレースホルダー(SVGをコンポーネント内に持つ)。
- UIアイコン: `public/icons/ui/`(キューブ・炎)。★は CSS/SVG で描く(画像不要)。
- 画像は同一オリジンから配信(外部へのホットリンクはしない)。

### 4.4 データ更新手順(開発者向け。README に記載)
```bash
node scripts/fetch-jms-items.mjs --version 419      # 装備マスタ(maplestory.io の最新JMS版番号を指定)
node scripts/fetch-icons.mjs --version 419          # アイコン
node scripts/fetch-kms-cube-tables.mjs              # KMS公式キューブ確率(約20分)
npm run build                                      # prebuild で manifest.json 更新
```
- maplestory.io の JMS 版番号は `https://maplestory.io/api/wz` の一覧で確認(2026-10-12 時点の最新は 419)。
- 取得スクリプトはどれも、**同じ結果が既にあればスキップ**し、失敗時はリトライする。

---

## 5. ドメインモデル(入力)

### 5.1 キャラクター
```ts
export interface CharacterInput {
  version: 1;
  id: string;                      // uuid
  name: string;                    // 表示用
  jobId: string;                   // jobs.json の id
  level: number;                   // 9レベルごと行の計算に使う
  displayedCP: number;             // ステータス画面の戦闘力(差分推定の基準)
  stats: Record<'STR'|'DEX'|'INT'|'LUK', StatInput>;   // 主ステ・副ステに使うものだけ必須(UIは職業に応じて表示)
  hp?: { pure: number; added: number };                // デーモンアヴェンジャーのみ
  attack: { final: number; pct: number };              // 魔法職は魔力。final=ステータス画面の値, pct=攻撃力%合計
  dmgPct: number; bossPct: number; critDmgPct: number; // ステータス画面の値
  equips: EquipInput[];
  updatedAt: string;
}
export interface StatInput {
  final: number;     // ステータス画面の最終値
  pct: number;       // %の合計(潜在・アディ・全ステ%・その他)。UIで「装備から自動集計した値」を参考表示
  nonPct: number;    // %が適用されない値(シンボル、ハイパーステ、ユニオン、HEXAステ 等)
}
```
- `pct` の入力補助: 入力済み装備の潜在/アディの主ステ%・全ステ%と炎の全ステ%を合計して「装備由来 xx%」を表示し、「装備以外(アビリティ等) yy%」を足して `pct` とする入力方式(`pct = 装備由来(自動) + その他(手入力)`)を既定にする。

### 5.2 装備
```ts
export interface EquipInput {
  slot: EquipSlot;                 // 'hat' | ... | 'ring1'..'ring4' | 'pendant1' | 'pendant2' | 'weapon' | 'secondary' | 'emblem' | 'pocket'
  itemId: number | null;           // items.json の id(未登録装備は null + 手入力)
  custom?: { name: string; lv: number; boss: boolean; baseAtt?: number; baseMatt?: number };
  star: number;                    // 現在★
  scrollAtt?: number;              // 武器のみ: 書・強化による攻撃力(★1-15の上昇計算に使う)
  scrollMatt?: number;
  potential: PotState;
  additional: PotState;
  flame: FlameState;
  overrides?: { sfDisabled?: boolean; maxStar?: number; flameDisabled?: boolean; potDisabled?: boolean; sparePriceMel?: number };
  targetStar?: number;             // ユーザーが決めた★の目標(順序計算の上限に使う)
}
export interface PotState { grade: Grade | 'none'; lines: [number|null, number|null, number|null] } // PotOption.id
export interface FlameState { str: number; dex: number; int: number; luk: number; att: number; matt: number;
  allStatPct: number; bossPct: number; dmgPct: number; hp: number; }
```
部位とマスタの対応: `ring1..4 → 'ring'`、`pendant1..2 → 'pendant'`。部位ごとの可否:

| 部位 | ★ | 潜在/アディ | 炎 |
|---|---|---|---|
| 武器 | ○ | ○ | ○ |
| 帽子/上着/下着/全身/靴/手袋/マント/ベルト | ○ | ○ | ○ |
| 顔/目/イヤリング/ペンダント | ○ | ○ | ○ |
| 指輪/肩 | ○ | ○ | ×(例外: スカーレットショルダー、シークレットリング は ○。`flame.json eligibility`) |
| 補助武器/エンブレム | ×(補助武器のうち強化可能回数>0 のものは ○。例: カンナの霊符は ○ — 2026-10-12) | ○ | × |
| 盾(補助武器扱い) | ○ | ○ | × |
| ポケット | × | × | ○ |

- ★の可否(2026-10-12): ★可 = 部位が対象(補助武器を含む) かつ 強化可能回数(`tuc`) > 0 かつ 装備固有の成長システム(`exGrade`)でない。専用呪文書のみの装備(`onlyUpgrade`、デスティニー武器)は★可。手入力の装備は上の表のとおり。
- 潜在の可否(2026-10-12): 潜在可 = 部位が対象 かつ (強化可能回数(`tuc`) > 0 または 部位が補助武器・エンブレム・盾) かつ `noPotential` でない。wz はシードリングに noPotential を持たないため、tuc 0 を潜在不可の印として使う(ゲーム側の規則の推定)。手入力の装備は部位の規則のまま。例外として、ゲーム内で潜在が付くと確認済みの tuc 0 装備は items.json の potentialOk で潜在可にする(エターナルフレイムリング、2026-10-12)。
- ★の上限: `maxStarByLevel`。`superior=1` は v1 では ★の計算対象外(表示のみ)。`overrides.maxStar` で上書き可。
- 「ボス報酬」(炎が4行・段階+2): `items.json` の `boss`。`flame.json bossItems.nonBossExceptions` に名前が一致するものは非ボス扱い。上書き可。

### 5.3 設定(`PlannerSettings`)
| キー | 既定 | 説明 |
|---|---|---|
| `include` | `{ starforce: true, potential: true, additional: true }` | 含める項目 |
| `starCatch` | `true` | 成功×1.05(JMS ver4.43以降は常時適用) |
| `events` | すべて `false` | `discount30` / `destroyDown30` / `guarantee51015` / `plusOneUnder10` |
| `vipRank` | `'none'` | VIP割引(現在★16以下に適用) |
| `star22PlusMultiplier` | `1.0` | ★22以上の費用倍率(JMS攻略の推定は1.2) |
| `destroyMode` | `'restorePrev'` | 破壊前★へ復旧 / ★12から再開 |
| `defaultSparePriceMel` | `0` | 復旧に使う同名装備1個の価格(装備ごとに上書き可) |
| `safeguardStars` | `[]` | 破壊防止する段階(15/16/17) |
| `sfMaxTarget` | `22` | 順序計算で考える★の上限(装備の最大★とユーザー目標★の小さい方で打ち切り) |
| `cubes` | `{ neo:{enabled:true, priceNP:100}, mega:{enabled:true, priceNP:156}, neoAdditional:{enabled:true, priceNP:355}, megaAdditional:{enabled:false, priceNP:491} }` | |
| `pointsPer100MMel` | `130` | メルマーケットの相場: 1億メルあたりのメイプルポイント。1NPあたりのメル = 1億 ÷ この値(保存済みの旧キー melPerNP は読み込み時に換算。旧既定値 1,000,000 のままなら未変更とみなし新既定値) |
| `miracleTime` | `false` | 等級上昇率2倍 |
| `useGuarantee` | `false` | 等級上昇保証(天井)を期待値に入れる(JMSで有無未確認のため既定OFF) |
| `cdrLinesPer2Sec` | `'auto'` | 帽子クール減2秒 = レジェ主ステ何行分。`'auto'`=職業既定(`jobs.json cdrLinesPer2Sec`)、または 0/0.5/1/1.5/2/2.5 |
| `includePerLvLines` | `false` | 「レベルごとに主ステ」行を潜在の目標候補に含める |
| `hideMaxed` | `true` | 上限★の装備を一覧から隠す |
| `flameBase` | `'eternal'` | 追加オプションの順番の基準炎(`powerful`/`eternal`/`black`) |
| `stepLimit` | `120` | スペックアップの順番に出すステップ数の上限 |

---

## 6. 計算仕様

すべて `src/domain/` の純粋関数で実装する。数値は倍精度浮動小数で扱うが、**炎の武器攻撃力だけは有理数(整数演算)で丸める**(§6.4.2)。

### 6.1 戦闘力モデル(`cp.ts`)

JMSにOpen APIはないので、戦闘力の絶対値は計算しない。**ユーザーが入力した表示戦闘力 `displayedCP` に、強化前後の因子の比を掛けて**上昇量を推定する(msuplanner と同じ方式)。武器定数・職業補正・最終ダメージは比を取ると打ち消される。

```
CP ∝ S × A × D × C
  S(ステ項)   = 職業の式(下表)で計算した値
  A(攻撃力項) = attFlat × (1 + attPct/100)        ※魔法職は魔力
  D(ダメージ項)= 1 + (dmgPct + bossPct)/100
  C(クリダメ項)= 1.35 + critDmgPct/100
```

| statFormula(jobs.json) | S |
|---|---|
| `standard` | 4×主ステ + 副ステ(副ステが2つの職は両方の合計) |
| `xenon` | 4×(STR+DEX+LUK) |
| `demonAvenger` | floor(純HP/3.5) + 0.8×floor(追加HP/3.5) + STR(★のHP上昇は v1 では扱わない。画面に注記) |

#### 6.1.1 基礎値の逆算
各ステ X について、入力 `final, pct, nonPct` から %適用前の固定値 `base_X = (final − nonPct) / (1 + pct/100)` を求める(小数のまま)。攻撃力は `attFlat = final / (1 + pct/100)`。

#### 6.1.2 変化量 Δ の適用
```ts
interface Delta { flat: Record<Stat, number>; pct: Record<Stat, number>; nonPct: Record<Stat, number>;
  attFlat: number; attPct: number; dmgPct: number; bossPct: number; critDmgPct: number; hpFlat: number }
statAfter(X) = (base_X + Δ.flat[X]) × (1 + (pct_X + Δ.pct[X])/100) + nonPct_X + Δ.nonPct[X]   // floor はしない(連続量で比較)
attAfter     = (attFlat + Δ.attFlat) × (1 + (attPct + Δ.attPct)/100)
cpAfter(Δ)   = displayedCP × S'/S × A'/A × D'/D × C'/C
gain(Δ)      = cpAfter(Δ) − displayedCP
```
- 全ステ%は STR/DEX/INT/LUK すべての `pct` に足す。全ステ固定値はすべての `flat` に足す。
- 「キャラクターレベルNごとにX +v」は `nonPct[X] += v × floor(level/N)`。攻撃力版は `attFlat` に足す(%の対象になる)。
- 帽子のクール減 `-n秒` は戦闘力に入らないが、設定 `cdrLinesPer2Sec` で**主ステ%に換算して** `pct[主ステ]` に足す: `n/2 × cdrLinesPer2Sec × レジェ主ステ行(その帽子)`。レジェ主ステ行 = その帽子のブラック・レジェ表に出る主ステ%の最大値(Lv200以下12、201以上13。表から求める)。換算を使ったステップには UI で「クール減換算」と表示する。
- 防御率無視・クリティカル率・HP%・メル/ドロップは 0 として扱う(戦闘力に入らない)。

#### 6.1.3 装備1部位の寄与の差し替え
ステップは「ある装備の状態 old → new」なので、`Δ = contrib(new) − contrib(old)` とする。`contrib(equip)` はその装備が持つ ★ステ・★攻撃力・潜在3行・アディ3行・炎を Δ の形に変換したもの。キャラの合計値(`final`/`pct`)には既に old が含まれている前提。

#### 6.1.4 線形化した重み(炎・表示用)
`w_k = gain(単位Δ_k)`(主ステ固定+1、副ステ固定+1、攻撃力+1、全ステ%+1、ボス%+1、ダメージ%+1 …)を現在状態で数値微分して求める。炎の分布計算(§6.4)と、詳細ポップオーバーの「主ステ換算」表示に使う。

### 6.2 スターフォース(`starforce.ts`)

#### 6.2.1 上昇量 `sfContrib(item, star)`
- ステ(STR/DEX/INT/LUK すべて): `star ≤ 15` は `statCumulative1to15[star-1]`、16〜22 は `statCumulative16[band][star-16]`(Lv帯 `levelBands`)、23以上は22と同じ。Lv127以下は★15まで。
- 防具/アクセの攻撃力・魔力: ★16以上 `armorAttCumulative16[band][star-16]`。手袋は `gloveAttStars` の各★で +1(攻撃力・魔力とも)。
- 武器の攻撃力: ★1〜15 は1つずつ `att += floor(att/50) + 1`(`att` の初期値 = 基本攻撃力 + `scrollAtt`)。★16以上は `att(★15) + weaponAttCumulative16[band][star-16]`。魔力も同様(基本魔力>0の武器のみ)。表に値が無い段階(未確定)はその★へのステップを生成しない。
- 装備Lvは**元のLv**(炎の着用Lv減少前)。

#### 6.2.2 1回の費用 `attemptCost(L, s, settings)`
```
base(L,s) = s<10 ? 1000 + L³(s+1)/36 : 1000 + L³(s+1)^2.7 / divisor[s]   → 100メル単位で四捨五入
if s≥22: base ×= star22PlusMultiplier
disc = (discount30 ? 0.7 : 1) × (vip && s≤16 ? 1−vipRate : 1)
cost = base × disc + (safeguard(s) ? base × 2.0 : 0)     // 破壊防止の加算分は割引しない。対象 s∈{15,16,17}
```
検算値: `tests/reference/starforce_expected.json` の `perAttempt`(Lv130〜250 × ★0〜29)。調査で集めた表と全一致することを確認済み。

#### 6.2.3 確率 `probs(s, settings)`
```
[p, k, d] = probabilityBase.table[s]
guarantee51015 && s∈{5,10,15} → [1,0,0]
destroyDown30 && s≤21 → k += 0.3d; d ×= 0.7
starCatch → p' = min(1, 1.05p); 残り(1−p') を k:d の元の比で按分
safeguard(s) → k += d; d = 0
```
`plusOneUnder10`(10★以下で成功時+2、最大12)は、成功時の遷移先を `min(s+2, 12)` にする(期待値計算は §6.2.4 の一般形で扱う)。

#### 6.2.4 期待コスト `expectedCost(L, a, b, settings, sparePrice)`
破壊時の遷移:
- `restorePrev`: ★`r = min(s, 22)` に戻る。追加費用 `R(s) = restoreMesoRatio[r] × base(L, r) + spareCount(r) × sparePrice`(`spareCount`: ★18以下1個、19〜20 2個、21 3個、22 4個)。
- `restart12`: ★12に戻る。追加費用 `sparePrice`(1個)。

「s→s+1 の期待コスト」`step[s]` を s の小さい方から順に求める(破壊後の戻り先 r ≤ s なので前から解ける):
```
back(r, s) = Σ_{t=r}^{s-1} step[t]           // 戻った後に s まで上がり直す費用
step[s] = (cost(s) + d·(R(s) + back(r,s))) / p
destroyCount[s] = d·(1 + Σ_{t=r}^{s-1} destroyCount[t]) / p
expectedCost(a,b) = Σ_{s=a}^{b-1} step[s]
```
`plusOneUnder10` 有効時のみ、一般形(状態 a..b の連立一次方程式をガウス消去)で解く。

検算値(`tests/reference/starforce_expected.json` の `cases`。Python参照実装 `tests/reference/starforce_ref.py` で計算。破壊時費用0):

| 条件 | 期待メル | 期待破壊回数 |
|---|---|---|
| Lv200 ★17→22 restart12 | 31,084,601,521 | 7.3541 |
| Lv200 ★17→22 restorePrev | 30,443,606,197 | 2.5194 |
| Lv200 ★22→25 restart12 | 473,299,624,128 | 120.053 |
| Lv200 ★22→25 restorePrev | 358,891,804,919 | 14.1424 |
| Lv150 ★0→17 restart12 | 543,548,907 | 0.1347 |

(restart12 の値は独立した調査計算 `starforce.json referenceExpected` とも一致)

#### 6.2.5 ★のステップ候補
現在★ s の装備について、`t = s+1 … min(s+6, 上限)` の各 t を候補にする(上限 = min(装備の最大★, `settings.sfMaxTarget`, `targetStar`))。`gain = gain(sfContrib(t) − sfContrib(s))`、`cost = expectedCost(L, s, t)`。

### 6.3 潜在能力・アディショナル(`potential.ts`)

#### 6.3.1 キューブと確率表の対応(`cubes.json`)
| JMSキューブ | 対象 | 使う確率表 | 等級上昇(レア→エピ / エピ→ユニ / ユニ→レジェ) |
|---|---|---|---|
| ネオキューブ | 潜在 | KMSレッド | 6% / 1.8% / 0.3% |
| メガキューブ | 潜在 | KMSブラック | 15% / 3.5% / 1.4% |
| ネオアディショナルキューブ | アディ | KMSエディショナル | 4.7619% / 1.9608% / 0.7% |
| メガアディショナルキューブ(期間限定) | アディ | KMSエディショナル | 同上 |

- 対応は推定(JMS非公開)。`confidence` を「計算方法」に表示する。
- シード版データにレッド表は無い → ブラック表で代用し警告(`fetch-kms-cube-tables.mjs` 実行で解消)。

#### 6.3.2 行の確率モデル
- 3行はそれぞれの行の分布(`lineDists`)から抽選。行2・3の「同等級/下位等級」の比率は表に織り込み済み。
- 制限グループ(KMS公式): `maxOne`(使えるスキル系・被撃後無敵時間)は3行中1行まで、`maxTwo`(被撃時ダメージ無視・被撃時無敵)は2行まで。上限に達したグループのオプションは次の行の候補から除き、残りを `p/(1−除外分)` で再正規化する。
- 目標達成確率は、各行のオプションを「目標カテゴリ c1..cm / それ以外」と「制限グループ」の組に縮約して、3行を**全列挙**して厳密に求める(状態数は高々 (m+1)×3 の3乗)。参照実装: `tests/reference/potential_ref.py`。

#### 6.3.3 目標(候補)の作り方
部位・種別ごとの**有用カテゴリ**(その表に実在するものだけ):

| 部位 | 潜在 | アディ |
|---|---|---|
| 武器・補助武器 | 攻撃力%(魔法職は魔力%)、ボス%、主ステ% | 攻撃力%、ボス%、主ステ% |
| エンブレム | 攻撃力%、主ステ% | 攻撃力%、主ステ% |
| 帽子 | 主ステ%、全ステ%、クール減(-1秒/-2秒) | 攻撃力+、主ステ%、全ステ%、(クール減があれば) |
| 手袋 | 主ステ%、全ステ%、クリダメ% | 攻撃力+、主ステ%、全ステ%、クリダメ% |
| その他の防具・アクセ | 主ステ%、全ステ% | 攻撃力+、主ステ%、全ステ% |
| (共通・設定ON時) | レベルごと主ステ | レベルごと主ステ |

- 「主ステ%」は職業の主ステ(ゼノンは STR/DEX/LUK の各%を同じカテゴリに含める)。
- カテゴリの**しきい値**= その等級の表に出るそのカテゴリの値の最小値(例: レジェの攻撃力%なら 12 と 9 → 9)。目標の行は「しきい値以上」で成功とし、戦闘力の上昇は**しきい値の値で出たと仮定**して計算する(保守的。msuplanner と同じ)。
- 目標 T = 目標等級 g(現在等級以上、ユニーク以上)と、カテゴリの多重集合(合計1〜3行、カテゴリは最大2種類まで)。例: `レジェ / 攻撃力%×2 + ボス%×1`。
- 目標の戦闘力: 「現在の3行」を「目標の行(しきい値) + 残りは無効行」に置き換えた Δ で `gain` を計算。`gain ≤ 0` の目標は捨てる。
- 現在の行が既に目標を満たしているものは捨てる。

#### 6.3.4 期待コスト
```
cubesToGrade(g0 → g) = Σ_{h=g0}^{g の1つ下} E_h,  E_h = 1/q_h           (q_h = tierUp[h] × (miracleTime?2:1))
                                    useGuarantee 時: E_h = (1 − (1−q_h)^N_h) / q_h   (N_h = guarantee[h])
cubesForTarget = 1 / P(T | g)                              // §6.3.2
expectedCubes  = cubesToGrade + cubesForTarget
cost(cube)     = expectedCubes × priceNP(cube) × melPerNP,  melPerNP = 1億 ÷ pointsPer100MMel
```
- 有効なキューブのうち `cost` が最小のものを採用し、ステップに記録(表示: 「メガキューブで平均 N 個」)。
- 等級を上げている途中の結果は使わない(等級が上がった時点から目標を狙い直す)近似。
- 検算値(`tests/reference/potential_expected.json`、シード表=ブラック/エディショナル):

| 目標 | 1回で揃う確率 |
|---|---|
| 武器Lv200 レジェ 攻撃力%(9以上)×1 | 17.2231% |
| 武器Lv200 レジェ 攻撃力%×2 | 1.06168% |
| 武器Lv200 レジェ 攻撃力%×3 | 0.021979% |
| 武器Lv200 レジェ 攻撃力%×2 + ボス%(30以上)×1 | 0.117999% |
| 帽子Lv160 レジェ STR%(9以上)×2 | 2.64412% |
| 帽子Lv160 レジェ クール-2秒×1 | 6.04542% |
| 手袋Lv160 レジェ クリダメ8%×2 | 0.258398% |
| 上着Lv160 アディ レジェ 攻撃力+12以上×1 | 11.2197% |

### 6.4 追加オプション(`flame.ts`)

#### 6.4.1 抽選ルール(KMS公式。`flame.json`)
- 行数: ボス報酬装備は4行。非ボス装備に炎を使うと 1/2/3/4行 = 40/40/16/4%。
- オプション: 部位別19種(`optionPools.weapon` / `optionPools.armor`)から**重複なしで均等**に選ぶ。Lv制限(`levelRestrictions`)に満たない種類は候補から除く。
- 段階: 行ごとに独立。`tierProbBase_1to5[炎]` に、ボス装備は +2段階。強力 3〜6段階、永遠/黒い 4〜7段階(ボス装備の場合)。
- 黒い炎は「旧/新を選べる」= 悪い結果は捨てられる。永遠と同じ段階確率。

#### 6.4.2 数値(L=元の装備Lv、s=段階)
| オプション | 値 |
|---|---|
| 単一ステ | (floor(L′/20)+1)×s、L′ = L≥250 ? 220 : L |
| 複合ステ(2種) | (floor(L/40)+1)×s を両方に |
| 攻撃力/魔力(防具) | s |
| 攻撃力/魔力(ボス武器) | ceil(B×(floor(L/40)+1)×s×1.1^(s−3)/100)。**有理数で計算**(1.1 = 11/10)。B=基本攻撃力 |
| 攻撃力/魔力(非ボス武器) | ceil(B×(floor(L/40)+1)×s×1.1^(min(s,5)−1)/100)(未確定。注記を出す) |
| 全ステ% | s |
| ボス% | 2s |
| ダメージ% | s |
| 最大HP | floor(L/10)×10×3×s(デーモンアヴェンジャーのみ使用) |
| 着用Lv減少・防御力・移動・ジャンプ・MP | 0(戦闘力に入らない) |

検算: ジェネシス片手剣(L200, B326) 段階3〜7 = 59/87/119/157/201、アブソ銃(L160, B150) = 23/33/46/60/77(`flame_ref.py` で一致確認)。

#### 6.4.3 炎の効率
装備ごとに:
1. 重み `w`(§6.1.4)で各オプションのスコア(=推定戦闘力上昇)を作る。現在の炎のスコア `cur = Σ w·現在値`。
2. 1回の炎で出る新スコア X の分布を厳密計算(全列挙、またはゼロ重みの種類をまとめる動的計画: `docs/research/30_flame.md` §7.4)。Worker で実行。
3. `pImprove = P(X > cur)`、`gainIfImprove = E[X − cur | X > cur]`、**効率 = E[max(0, X − cur)]**(炎1個あたりの期待戦闘力上昇)。
4. 表示: 効率の高い順に装備を並べ、セルに `pImprove`(%)を出す。ポップオーバーに「平均 1/pImprove 個で改善」「改善時の平均上昇 +gainIfImprove」「現在の炎スコア(主ステ換算)」。
5. 基準の炎は設定 `flameBase`(強力/永遠/黒い)。
- 検算(重み 主1・攻4・全ステ%10、ボス防具、永遠): L200 平均45.08、P(≥100)=6.5943%(`flame.json referenceResults...` と一致)。

### 6.5 強化順序(`planner.ts`)

#### 6.5.1 アルゴリズム(貪欲法+先読み)
```
state = 入力キャラの複製
plan = []
loop (plan.length < stepLimit):
  cands = []
  for each equip:
    if include.starforce: ★候補(§6.2.5) を全部
    if include.potential: 潜在候補(§6.3.3) を全部
    if include.additional: アディ候補 を全部
  各候補の efficiency = gain / cost(state に対する gain を毎回計算)
  best = efficiency 最大(同値なら cost の小さい方)
  if best なし or best.gain ≤ 0: break
  plan.push(best); state に best を適用(★を上げる / 潜在の行を目標行(しきい値)に置き換え・等級を更新)
```
- ★の先読み(t=s+1..s+6)で、「次の1段は効率が悪いが2段先まで上げると良い」ケースを拾う。
- ステップを適用するたびに CP の基準も更新する(`displayedCP` を `cpAfter` に置き換え、キャラの合計値にも Δ を反映)。
- 計算量: 装備20 × 候補(★6 + 潜在〜30 + アディ〜30) × 120ステップ ≒ 15万回の `gain` 評価。Worker で 300ms 以内を目標。

#### 6.5.2 表示用のまとめ
- 同じ装備の★ステップが**連続**したら1マスにまとめる(例 `20→22`)。
- 潜在/アディのマスは目標の行数(`×3` など)と等級色を表示。
- 効率の四分位(上位25% / 25-50 / 50-75 / 下位25%)で枠と連結線の色を変える(緑 / 紫 / 黄 / 赤)。

#### 6.5.3 1マスの詳細(ポップオーバー)
装備名と★/目標、期待コスト(メル)、戦闘力 +x(+y%)、順位、使うキューブと平均個数(潜在)、期待破壊回数(★)、前提(推定・代用表・クール減換算)、「この装備の全候補を見る」(候補表: 目標・確率・期待個数・コスト・効率)。

---

## 7. 画面設計

### 7.1 全体
- 1ページ構成。上部ヘッダー(アプリ名、テーマ切替)。その下にキャラヘッダー(名前、職業、Lv、表示戦闘力、編集、キャラ切替、JSON書き出し/読み込み)。
- タブ: **強化順序**(既定) / **キャラ・装備入力** / **設定**。
- 配色は msuplanner に近いダーク基調(背景 #0f1020 系、アクセント紫 #8b7cf6、効率色: 緑 #34d399 / 紫 #a78bfa / 黄 #fbbf24 / 赤 #f87171)。ライトテーマも用意。トークンは CSS 変数で定義。
- 幅 360px でも横スクロールしない(グリッドは折り返し)。

### 7.2 キャラ・装備入力
1. **基本情報**: キャラ名、職業(50職のセレクト。系統でグループ化)、Lv、表示戦闘力。
2. **ステータス**: 職業の主ステ・副ステだけ表示。各ステに「最終値 / %合計 / %未適用値」。%合計の横に「装備から自動集計: xx% + その他 [入力]」。攻撃力(魔力)最終値と攻撃力%、ダメージ%、ボス%、クリダメ%。各項目にゲーム内のどこで見るかのヘルプ(ⓘ)。
3. **装備**: 部位カード(グリッド)。カードを押すと右側(スマホは下)に編集パネル。
   - アイテム検索(コンボボックス): 部位で絞った `items.json` を日本語名で部分一致。アイコン・Lv・セット名を表示。未登録装備は「手入力」(名前・Lv・ボス報酬・基本攻撃力)。
   - ★: 数値ステッパー(0〜最大★)。
   - 潜在 / アディ: 等級セレクト + 3行のセレクト(選択肢はその部位・Lv・等級の表に出るオプションのみ。日本語表示。「なし/その他」あり)。行の並びは自由。
   - 追加オプション: STR/DEX/INT/LUK/攻撃力/魔力/全ステ%/ボス%/ダメージ%(/HP: デーモンアヴェンジャー)の数値欄。
   - 武器のみ: 書・強化による攻撃力(魔力)。
   - 上書き: ★強化しない、最大★、ボス報酬扱い、復旧用装備の価格、目標★。
   - 入力途中でも自動保存(300msデバウンス)。
4. 入力チェック: 必須欄の未入力、★が上限超え、行の値が表に無い、などを黄色で表示(計算は可能な範囲で続行)。

### 7.3 強化順序
- **含める項目**: スターフォース / 潜在能力 / アディショナル のチェック(すべて選択・すべて解除)。
- **スペックアップの順番**: アイコングリッド(1マス=56px。装備アイコン、下に `22` / `20→22` / `×3`、右上に種別バッジ[潜在=紫/アディ=緑])。マスの間を効率色の線でつなぐ。最初60件+「もっと見る(+N)」。
- 凡例と「計算方法」(折りたたみ): §6 の要約、使っている前提(KMS基準・キューブ対応・代用表・クール減換算値)。
- **追加オプションの順番**: 基準の炎セレクト(強力/永遠/黒い)。マス=装備アイコン+改善確率%。
- 再計算は入力・設定の変更から 300ms デバウンスで Worker に投げる。計算中はスケルトン表示。

### 7.4 設定
§5.3 の各項目を、グループ(スターフォース / キューブ / 換算 / 表示)に分けて表示。各項目に説明文と既定値に戻すボタン。

---

## 8. 非機能要件
- 初回表示: データ合計 2MB 以下(gzip後 0.5MB 程度)。アイコンは遅延読み込み。
- 計算: Worker で 1回 300ms 以内(装備20・ステップ120)。UI はブロックしない。
- 保存: 入力はすべてローカル。外部送信なし。アクセス解析も入れない。
- アクセシビリティ: キーボード操作(Tab/Enter/矢印)、フォーカス表示、色だけに頼らない(効率の四分位はラベルでも表示)。

## 9. テスト
| 対象 | 方法 | 合格基準 |
|---|---|---|
| ★1回費用 | `perAttempt` 全値(Lv130〜250 × ★0〜29) | 完全一致 |
| ★期待値 | `starforce_expected.json` の全 `cases` | 相対誤差 1e-9 以内 |
| 潜在確率 | `potential_expected.json` の全ケース。確率表は `tests/fixtures/kms-cube-tables.seed.json`(シード版の固定コピー)を使う(本番データを更新してもテストが揺れないように) | 絶対誤差 1e-9 以内 |
| 炎 | `flame_expected.json`、武器攻撃力の検算5組×2 | 平均・確率が小数6桁一致、攻撃力完全一致 |
| 炎DP | 全列挙との一致(ランダムな重み10通り) | 一致 |
| 戦闘力モデル | `cp_expected.json`(架空キャラ×9ケース。`cp_ref.py`)、Δ=0 で gain=0、全ステ%が主副両方に効く 等 | 相対誤差 1e-9 以内 |
| プランナー | 小さな手作りキャラで、効率降順・連続★のまとめ・gain≤0で停止 | |
| 保存 | zod 検証、壊れたJSONの退避、移行 | |

参照実装は Python(`tests/reference/*.py`)。期待値JSONを Vitest から読み込んで比較する。

## 10. GitHub Pages への配信
- `vite.config.ts`: `base: process.env.VITE_BASE ?? '/jms-planner/'`。アセット・データの URL は必ず `import.meta.env.BASE_URL` を前置。
- ルーティングは使わない(1ページ+タブ。タブ状態は `location.hash` に保存)。404.html 不要。
- `.github/workflows/deploy.yml`(main への push で実行):
  1. `actions/checkout@v4` → `actions/setup-node@v4`(node 20, cache npm)
  2. `npm ci` → `npm run lint` → `npm test` → `npm run build`(`VITE_BASE=/${{ github.event.repository.name }}/`)
  3. `actions/configure-pages@v5` → `actions/upload-pages-artifact@v3`(`dist`)→ `actions/deploy-pages@v4`
  4. `permissions: { contents: read, pages: write, id-token: write }`、`concurrency: pages`
- データ生成スクリプトは CI で実行しない(生成済みの `public/data` と `public/icons` をコミットする)。
- 注意: GitHub Pages は**リポジトリが非公開でもサイトは公開URL**になる(Enterprise Cloud の限定公開を除く)。`robots.txt` と `<meta name="robots" content="noindex">` で検索避けし、キャラデータは localStorage のみに置く。

## 11. 未確定事項と扱い
| 項目 | 既定の扱い | 変更手段 |
|---|---|---|
| JMSのキューブ確率・対応 | KMSのレッド/ブラック/エディショナルを対応付け | `cubes.json` |
| JMSのキューブ価格 | パック価格から算出した初期値 | 設定 |
| JMSの天井(等級上昇保証) | 使わない | 設定 `useGuarantee` |
| ★22以上の費用倍率 | 1.0(KMS) | 設定 1.0/1.2 |
| VIP割引の上限★ | 現在★16まで | `starforce.json` |
| 破壊時の復旧メル・個数 | KMSの比率・個数 | `starforce.json` |
| 武器★の一部段階 | 計算しない | データ追記 |
| 非ボス武器の炎攻撃力 | GMS系の式 | `flame.json` |
| 黒い転生の炎の入手可否 | 選択肢に残す | 設定 |
| メル換算レート | メルマーケット 1億メル=130ポイント(1ポイント=1NP は未確認) | 設定 |

## 12. 出典
- スターフォース: `public/data/starforce.json meta.sources`、`docs/research/10_starforce_research.json`
- キューブ: `public/data/cubes.json meta.sources`、KMS公式 https://maplestory.nexon.com/Guide/OtherProbability/cube/red ・/black ・/addi
- 追加オプション: `docs/research/30_flame.md`
- 戦闘力・職業・帽子クール減: `docs/research/40_character_cp.md`、`public/data/jobs.json _meta`
- 元サイトの分析: `docs/research/00_msu_site_analysis.md`
