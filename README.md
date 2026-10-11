# JMS 装備強化順序プランナー — 実装キット

msuplanner.com の「スペックアップの順番」を、日本版メイプルストーリー(JMS)向けに作り直すためのキットです。Claude Code に渡して実装してもらう前提でまとめています。

## 中身
| パス | 内容 |
|---|---|
| `PROMPT.md` | Claude Code に渡す依頼文(フェーズ・守ること・完了の定義) |
| `docs/DESIGN.md` | 詳細設計書(スコープ、データ設計、計算仕様、画面、テスト、GitHub Pages) |
| `docs/research/` | 調査メモ(元サイト分析、スターフォース、潜在、追加オプション、戦闘力・職業)と出典 |
| `public/data/starforce.json` | ★の確率・費用式・破壊防止・VIP・イベント・復旧・上昇量表 |
| `public/data/cubes.json` | JMSキューブと KMS 確率の対応、等級上昇確率、初期価格 |
| `public/data/potential/kms-cube-tables.json` | KMS公式の行別オプション確率(シード版。完全版はスクリプトで取得) |
| `public/data/flame.json` | 転生の炎の確率・数値式 |
| `public/data/jobs.json` | 50職の主ステ/副ステ、帽子クール減の既定価値 |
| `scripts/` | データ生成スクリプト(装備マスタ、アイコン、確率表の完全版、manifest) |
| `tests/reference/` | Python参照実装と期待値JSON(アプリの計算がこれと一致することをテストする) |

## 使い方
1. GitHub に空のリポジトリ(例 `jms-planner`)を作り、このキットの中身をルートに置く。
2. Claude Code を起動し、`PROMPT.md` の「依頼」以下を渡す。
3. Phase 1 でデータ取得スクリプトが動く(ネット接続が必要。合計30分ほど)。

## データについて
- JMSで公開されていない確率・費用は KMS 公式値を使っています。各ファイルの `meta` に出典と確度があります。
- `items.json` とアイコンは maplestory.io(有志の非公式API)から、キューブ確率は KMS 公式サイトの公開ページから取得します。どちらも取得間隔を空けて実行してください。
- ゲームの名称・画像の権利は NEXON に帰属します。個人利用の範囲で使ってください。GitHub Pages は公開URLになるため、検索避け(robots.txt / noindex)を入れています。
