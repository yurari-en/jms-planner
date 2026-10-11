# Claude Code への実装依頼プロンプト

以下をそのまま Claude Code に渡してください(このキット一式をリポジトリのルートに置いた状態で)。

---

## 依頼

あなたは TypeScript / React のシニアエンジニアです。このリポジトリに、日本版メイプルストーリー(JMS)向けの**装備強化順序プランナー**(個人利用の静的Webアプリ。GitHub Pages で配信)を実装してください。

仕様の正本は `docs/DESIGN.md` です。**最初に DESIGN.md を全部読み**、続けて `docs/research/` と `public/data/` の各ファイルの構造を確認してから作業を始めてください。DESIGN.md と矛盾する判断が必要になったら、勝手に変えずに私に質問してください。

### 守ること
1. **スコープは DESIGN.md §0.2 の F1〜F5 だけ**。キューブ一覧・シミュレーター・シードリング・相場・API連携・多言語は作らない。
2. 画面の文言はすべて日本語。通貨は「メル」。
3. 確率・費用・上昇量などの**数値は `public/data/*.json` から読む**。コードに数値を直書きしない(テストの期待値は除く)。データの意味を変える修正(値の書き換えなど)をしたくなったら、先に私に確認する。
4. 計算ロジックは `src/domain/` の**純粋関数**にまとめ、React・DOM・ストレージに依存させない。重い計算は Web Worker で動かす。
5. **テストを先に書く**: `tests/reference/*_expected.json` の期待値(Python参照実装で計算済み)と一致することを Vitest で確認してから UI に進む。
6. 実行時に外部サーバーへリクエストしない。データとアイコンは同一オリジンの静的ファイルにする。URL は必ず `import.meta.env.BASE_URL` を前置する。
7. ユーザーデータは localStorage のみ(キー名・形式は DESIGN.md §4.2)。リポジトリにコミットしない。
8. パッケージはバージョンを固定して入れる。不要な依存は増やさない。

### 作業の進め方(フェーズごとに、終わったら `npm test` と `npm run build` が通ることを確認し、要点を報告してからコミット)

**Phase 0: 土台**
- Vite + React + TypeScript(strict)+ Tailwind + Zustand + zod + Comlink + Vitest + ESLint/Prettier で雛形を作る。
- `vite.config.ts` の `base` は `process.env.VITE_BASE ?? '/jms-planner/'`。
- `package.json` の scripts: `dev` / `build`(`prebuild` で `node scripts/build-manifest.mjs`)/ `preview` / `test` / `lint` / `data:items` / `data:icons` / `data:cubes`。
- `.github/workflows/deploy.yml` を DESIGN.md §10 のとおりに作る。
- `public/robots.txt`(`Disallow: /`)と `index.html` の `noindex`。

**Phase 1: データ**
- 次を順に実行して `public/data/items.json`、`public/icons/`、完全版の `public/data/potential/kms-cube-tables.json` を作る(ネットに接続できる手元で実行。時間がかかるので途中経過を表示させる):
  ```bash
  node scripts/fetch-jms-items.mjs --version 419
  node scripts/fetch-icons.mjs --version 419
  node scripts/fetch-kms-cube-tables.mjs
  ```
  - 先に `https://maplestory.io/api/wz` で JMS の最新版番号を確認し、419 より新しければそれを使う。
  - 取得に失敗した場合は、同梱のシード版(`kms-cube-tables.json` は既にシード版が入っている)のまま進め、失敗内容を報告する。
  - 生成後、件数(装備数、アイコン数、確率表のキー数、Lv帯の数)を報告する。
- `src/data/types.ts`・`loader.ts`・`indexes.ts` を DESIGN.md §4.1 のとおりに作り、確率表のフォールバック(red→black、overall→top、shield→secondary)と警告フラグを実装する。

**Phase 2: 計算(`src/domain/`)** — DESIGN.md §6
- `starforce.ts`: 上昇量、1回費用、確率、期待コスト(restorePrev / restart12、イベント、破壊防止、VIP、★22以上倍率)。
- `potential.ts`: 行の確率モデル(制限グループの再正規化)、目標候補の生成、達成確率の厳密計算、等級上昇を含む期待コスト、キューブ選択。
- `flame.ts`: 数値式(武器攻撃力は有理数で ceil)、1回の炎の結果分布(全列挙+DP、DP は全列挙と一致することをテスト)、効率指標。
- `cp.ts`: 戦闘力モデル、基礎値の逆算、Δの適用、装備1部位の寄与、線形化重み、帽子クール減の換算。
- `planner.ts`: 貪欲法+★の先読み、連続★のまとめ、四分位。
- テスト: `tests/reference/` の期待値JSONをすべて読み込んで比較する単体テスト(DESIGN.md §9 の表の合格基準)。

**Phase 3: 画面** — DESIGN.md §7
- キャラヘッダー、タブ(強化順序 / キャラ・装備入力 / 設定)、装備カードと編集パネル(アイテム検索コンボボックス、★ステッパー、潜在/アディの行セレクト、炎の数値欄)、強化順序グリッドとポップオーバー、追加オプションの順番、設定画面、JSON書き出し/読み込み、ダーク/ライト。
- スマホ幅(360px)でも横スクロールしないこと。

**Phase 4: 仕上げ**
- README.md(使い方、データ更新手順、前提と未確定事項の一覧、出典)。
- サンプルキャラ(架空)の JSON を `public/sample/sample-character.json` に置き、初回起動時に「サンプルを読み込む」ボタンを出す。
- Lighthouse で Performance / Accessibility 90 以上を目安に調整。
- GitHub Pages にデプロイできる状態にして、手順を報告する。

### 完了の定義
- `npm test` がすべて通る(参照期待値との一致を含む)。
- `npm run build` が通り、`npm run preview` でサンプルキャラの強化順序と追加オプションの順番が表示される。
- 入力→順序の再計算が体感で 0.5 秒以内。
- DESIGN.md §11 の未確定事項が、設定画面または「計算方法」に明記されている。
