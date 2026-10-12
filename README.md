# JMS 装備強化順序プランナー

日本版メイプルストーリー(JMS)向けの、**装備強化の順番**を考えるための個人用 Web アプリです。
手入力したキャラクターと装備の現状から、「次にどの装備をどう強化すると、かけたメルに対して戦闘力が最も伸びるか」を
**戦闘力上昇 ÷ 期待コスト(メル)** の順に並べて表示します。msuplanner.com の「スペックアップ」タブを JMS 向けに作り直したものです。

- 静的サイト(Vite + React)。GitHub Pages で配信できます。
- 実行時に外部サーバーへは一切アクセスしません。キャラデータはブラウザの localStorage にだけ保存されます。
- 仕様の正本は [`docs/DESIGN.md`](docs/DESIGN.md)、調査メモは [`docs/research/`](docs/research/) です。

## 画面

| タブ | 内容 |
|---|---|
| **強化順序** | スペックアップの順番(スターフォース・潜在・アディショナルの全ステップを効率順に並べたグリッド)、追加オプションの順番(転生の炎1個あたりの期待戦闘力上昇が高い装備順)、計算方法 |
| **キャラ・装備入力** | 職業・Lv・表示戦闘力・ステータス、部位ごとの装備(アイテム検索、★、潜在/アディの3行、追加オプション、上書き) |
| **設定** | スターキャッチ、イベント、VIP割引、破壊の扱い、破壊防止、キューブの有効/価格、メル換算レート、帽子クール減の価値 など。未確定事項の一覧もここにあります |

## 使い方

### 1. 起動

GitHub Pages のURL、または手元で `npm run dev` / `npm run preview` を開きます。
初回は「サンプルを読み込む」で架空のキャラを読み込むと、画面の動きを確認できます(サンプルは実在のキャラではありません)。

### 2. キャラ・装備入力

ゲーム内の **ステータス画面** の値をそのまま入れます。各欄の ⓘ にゲーム内での確認場所があります。

| 欄 | 入れる値 |
|---|---|
| 表示戦闘力 | ステータス画面の「戦闘力」。上昇量はこの値を基準にした**比率**で推定します(絶対値は計算しません) |
| 主ステ / 副ステ | 「最終値」「%の合計」「%未適用の値」(ステータス画面の詳細表示)。%の合計は「装備から自動集計」+「その他(アビリティ等)」で入力します |
| 攻撃力(魔法職は魔力) | 最終値と攻撃力%の合計 |
| ダメージ% / ボス% / クリダメ% | ステータス画面の値 |

装備は部位カードを押して右(スマホでは下)の編集パネルで入力します。

- **アイテム検索**: 日本語名の部分一致(ひらがな/カタカナ、全角/半角は同一視)。一覧に無い装備は「手入力」で名前・Lv・ボス報酬・基本攻撃力を入れます。
- **★**: 現在の★。上限は装備Lvから自動で決まります(上書き可)。
- **潜在 / アディショナル**: 等級と3行。選択肢はその部位・Lv・等級の確率表に出るものだけです。
- **追加オプション(転生の炎)**: STR/DEX/INT/LUK/攻撃力/魔力/全ステ%/ボス%/ダメージ% の数値。
- **上書き**: ★強化しない、最大★、ボス報酬扱い、復旧用装備の価格、目標★ など。

入力は自動保存されます(300msデバウンス)。

### 3. 強化順序の見方

- 1マス = 1ステップ(「装備X の ★a→b」「装備X の潜在を目標T にする」)。同じ装備の連続した★は 1マスにまとめます(例 `20→22`)。潜在/アディは目標の行数を `×3` のように表示し、右上に種別バッジ(潜在=紫 / アディ=緑)が付きます。
- 枠と連結線の色は効率の四分位です: **緑** 上位25% / **紫** 25〜50% / **黄** 50〜75% / **赤** 下位25%。
- マスを押すと詳細(期待コスト、戦闘力上昇、順位、使うキューブと平均個数、期待破壊回数、前提、この装備の全候補)が開きます。
- 「含める項目」でスターフォース / 潜在 / アディを個別に外せます。
- **追加オプションの順番**は、基準の炎(強力/永遠/黒い)1個あたりの期待戦闘力上昇が高い順です。マスの%は「炎1個で今より良くなる確率」です。

### 4. 設定

キャラ共通です。各項目に説明と「既定に戻す」があります。JMSで公開されていない値(キューブの確率・価格、★22以上の費用倍率、復旧費用など)はここで上書きできます。

### 5. JSON の書き出し / 読み込み

キャラヘッダーの「JSON書き出し」で 1件または全件を `jms-planner-{キャラ名}-{YYYYMMDD}.json` に保存できます。
「JSON読み込み」では差分を確認してから「上書き」か「別名で追加」を選べます。
**GitHub Pages は公開URLになるので、キャラデータをリポジトリにコミットしないでください。**

## 計算の概要

| 項目 | 方法(詳細は `docs/DESIGN.md` §6) |
|---|---|
| 戦闘力 | `CP ∝ ステ項 × 攻撃力項 × (1+ダメ%+ボス%) × (1.35+クリダメ%)`。入力した表示戦闘力に強化前後の因子の比を掛けて上昇量を推定 |
| スターフォース | KMS公式の確率・費用式・上昇量表。破壊時は「破壊前の★へ復旧」または「★12から再開」の期待コスト。スターキャッチ、イベント、VIP、破壊防止、★22以上倍率に対応 |
| 潜在 / アディ | KMS公式の行別確率表(レッド/ブラック/エディショナル)。目標(等級+カテゴリの多重集合)が1回で揃う確率を全列挙で厳密に計算し、等級上昇の期待個数を足す。有効なキューブのうち最安のものを採用 |
| 追加オプション | KMS公式の行数・段階・候補の均等抽選。1回の炎のスコア分布を動的計画で厳密に求め、`E[max(0, 新スコア − 現在スコア)]` で並べる |
| 強化順序 | 貪欲法(毎回、効率最大のステップを適用して状態を更新)+ ★の先読み(最大6段) |

計算はすべて `src/domain/` の純粋関数で、Python 参照実装(`tests/reference/`)の期待値と一致することを `npm test` で確認しています。

## 前提と未確定事項

JMS は確率・費用の多くを公開していないため、**KMS 公式値を基準**にしています。各値の出典と確度はデータファイルの `meta` / `confidence` にあります。

| 項目 | 既定の扱い | 変更手段 |
|---|---|---|
| JMSのキューブ確率・対応 | ネオ=KMSレッド、メガ=KMSブラック、ネオ/メガアディ=KMSエディショナル(推定) | `public/data/cubes.json` |
| JMSのキューブ価格 | パック価格から算出した初期値(ネオ100NP / メガ156NP / ネオアディ355NP / メガアディ491NP) | 設定 |
| JMSの天井(等級上昇保証) | 使わない | 設定 `useGuarantee` |
| ★22以上の費用倍率 | 1.0(KMS)。JP攻略の推定は1.2 | 設定 |
| VIP割引の上限★ | 現在★16まで | `public/data/starforce.json` |
| 破壊時の復旧メル・個数 | KMSの比率・個数 | `public/data/starforce.json` |
| 武器★の一部段階(Lv140〜160の★26以上、Lv250の★23以上) | 未確定のため計算しない | データ追記 |
| 非ボス武器の炎攻撃力 | GMS系の式(未確定) | `public/data/flame.json` |
| 黒い転生の炎の入手可否 | 選択肢に残す(JMSでの入手は未確認) | 設定 |
| メル換算レート | 1億メル = 100NP | 設定 |
| 帽子クール減の価値 | 職業別の既定(2秒 = レジェ主ステ何行分)。KMS未実装職(ハヤト/カンナ/リン)は1.0行 | 設定 |
| 潜在のない装備(等級「なし」) | レア扱いで等級上昇を計算 | — |
| ゼノンの主ステ%目標 | STR/DEX/LUK を同じカテゴリとし、上昇量は先頭の1ステで近似 | — |
| デーモンアヴェンジャー | HP%潜在・★のHP上昇は未対応。HPの重みは floor の階段を平均した傾き | — |
| ★1回費用の丸め | Python参照実装(銀行家の丸め)に合わせる。ゲーム内の表と .5 ちょうどの4マスで100メル異なる | — |
| シュペリアル装備 | ★の計算対象外(表示のみ) | — |

設定画面の「未確定事項と前提」と、強化順序タブの「計算方法」にも同じ内容を出しています。

## 開発

Node 20 以上。

```bash
npm install
npm run dev        # 開発サーバー
npm test           # Vitest(参照期待値との一致を含む)
npm run lint       # ESLint + Prettier
npm run build      # prebuild で public/data/manifest.json を更新してから dist/ を生成
npm run preview    # dist/ をローカル配信(/jms-planner/ 配下)
```

ディレクトリ構成は `docs/DESIGN.md` §2 のとおりです。計算ロジックは `src/domain/`、データの型・読み込み・索引は `src/data/`、状態は `src/store/`、画面は `src/components/`、重い計算は `src/worker/`(Comlink)です。

### ローカルで配信を検証する(GitHub Pages 相当)

```bash
npm run build            # dist/ を /jms-planner/ 前提で生成
npm run preview:static   # http://127.0.0.1:4174/jms-planner/ で配信(SPA フォールバック無し)
```

- `npm run preview`(vite preview)と違い、GitHub Pages と同じく**ベースパス配下だけを配信し、存在しないファイルは 404** を返します。存在しないアイコンなど、vite preview では隠れる 404 をここで検出できます。
- 別のベースパスを確かめるときは `VITE_BASE=/foo/ npm run build` のあと `VITE_BASE=/foo/ npm run preview:static`。ポートは `PORT=8080` のように変えられます。
- 手元(127.0.0.1)だけで動き、ファイルは外部に出ません(公開不要)。

## データ更新手順(開発者向け)

ネットに接続できる手元で実行します。CI では実行しません(生成済みの `public/data` と `public/icons` をコミットします)。
どのスクリプトも、同じ結果が既にあればスキップし、失敗時はリトライします。

```bash
# 1) maplestory.io の JMS 最新版番号を確認(2026-10-12 時点の最新は 444)
#    https://maplestory.io/api/wz  の region=JMS で isReady=true の最大値
# 2) 装備マスタ(Lv100以上)とアイコン
node scripts/fetch-jms-items.mjs --version 444     # → public/data/items.json(約40分)
node scripts/fetch-icons.mjs --version 444         # → public/icons/items/{id}.png、public/icons/ui/*.png(約15分)
# 3) KMS公式キューブ確率表(完全版)
node scripts/fetch-kms-cube-tables.mjs             # → public/data/potential/kms-cube-tables.json(約20分)
# 4) manifest.json を更新
npm run build
```

`package.json` の `data:items` / `data:icons` / `data:cubes` も同じコマンドです(版番号は `package.json` 内で固定)。
確率表のオプション id は取得順に振られるため、再取得すると番号が変わることがあります。キャラデータには各行の原文(`lineKr`)も保存しているので、番号が変わっても行は復元されます。

## GitHub Pages への配信

### 前提(2026-10-12 に確認)

- **無料プランでは非公開リポジトリで GitHub Pages を使えません**(API が `Your current plan does not support GitHub Pages for this repository` を返す)。
  公開リポジトリにするか、Pages が使えるプランにしてください。公開にする場合、ソースと装備アイコン(NEXON 権利物)も公開されます。
- 公開したくない場合は Pages を使わず、上記の「ローカルで配信を検証する(GitHub Pages 相当)」で代替できます(非公開リポジトリは無料プランでは Pages 不可)。
- `gh` のトークンにワークフローファイルを push する権限(`workflow` スコープ)が必要です。無い場合は次を実行してブラウザで承認します。

```bash
gh auth refresh -h github.com -s workflow
```

### 最短手順(GitHub CLI `gh` にログイン済みの場合)

```bash
# リポジトリ作成 + push(非公開でも Pages のURLは公開になる点に注意)
gh repo create jms-planner --public --source . --remote origin --push   # 既に作成済みなら: git push -u origin main
# Pages のソースを GitHub Actions にする
gh api --method POST repos/{owner}/jms-planner/pages -f build_type=workflow
# ワークフローの実行状況
gh run watch
# 公開URL: https://<ユーザー名>.github.io/jms-planner/
```

既に Pages が有効なリポジトリでは 2 行目は `--method PUT` で `build_type=workflow` に更新します。

### 手動手順

1. GitHub に空のリポジトリを作り(例 `jms-planner`)、このディレクトリの中身を push します(`main` ブランチ)。
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にします。
3. `main` に push すると `.github/workflows/deploy.yml` が `npm ci → lint → test → build → deploy` を実行します。
   ビルド時の `VITE_BASE` は `/<リポジトリ名>/` になります(手元で別のパスにする場合は `VITE_BASE=/foo/ npm run build`)。
4. 公開URLは `https://<ユーザー名>.github.io/<リポジトリ名>/` です。

注意: GitHub Pages は**リポジトリが非公開でもサイトは公開URL**になります(Enterprise Cloud の限定公開を除く)。
`public/robots.txt`(`Disallow: /`)と `<meta name="robots" content="noindex">` で検索避けをしていますが、URLを知っている人は見られます。
キャラデータは localStorage にだけ置き、リポジトリにはコミットしないでください。

## 出典

- スターフォース: `public/data/starforce.json` の `meta.sources`、`docs/research/10_starforce_research.json`
- キューブ: `public/data/cubes.json` の `meta.sources`、KMS公式 https://maplestory.nexon.com/Guide/OtherProbability/cube/red ・/black ・/addi
- 追加オプション: `docs/research/30_flame.md`、KMS公式 https://maplestory.nexon.com/Guide/OtherProbability/game/gameAddOption
- 戦闘力・職業・帽子クール減: `docs/research/40_character_cp.md`、`public/data/jobs.json` の `_meta`
- 装備マスタ・アイコン: maplestory.io(有志運営の非公式API)JMS v444
- 元サイトの分析: `docs/research/00_msu_site_analysis.md`

ゲームの名称・画像の権利は NEXON に帰属します。個人利用の範囲でお使いください。
