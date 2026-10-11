# 40. JMS キャラクターデータ取得 / 戦闘力計算 / 強化効率 調査 (2026-10-12)

対象: 日本版メイプルストーリー(JMS)向けの個人用「強化効率(戦闘力上昇 ÷ 期待コスト)」ツール。
地域ラベル: **[JP公式] [JP攻略] [KR公式] [KR攻略] [英語圏]**。「未確認」と書いた項目は一次情報でまだ確かめていない。

> **最重要の前提(調査中に判明)**
> - JMSの通貨は**「メル」**(KMS/GMSの「メソ」に相当)。JMSの公式告知でも「メル」と書かれている [JP公式]。そのため本ツールのUI・型名は `mel` にそろえる(依頼文の「メソ」は「メル」と読み替える)。
> - JMSには**Nexon Open APIがない**(2026-10時点)。キャラデータは手入力かスクショOCRで取り込む前提で設計する。
> - JMSのキューブ名はKMSと違う。2024-05-22に**ブラックキューブとマスターアディショナルミラクルキューブの販売が終わり**、**メガキューブ / ネオアディショナルキューブ**の販売が始まった [JP公式]。

---

## 1. JMSキャラクターデータの取得手段

### 1.1 公式Open API(JMS版)の有無 → **なし**
| 根拠 | 地域 | URL |
|---|---|---|
| Nexon Open APIの非公式クライアントSpiralMoon/maplestory.openapi(v3.11.0、最終コミット2026-07-06)のREADMEでは、**KMS/TMS/MSEA = support、JMS/GMS/CMS = not_supported**。READMEには「Nexonが新しい地域のAPIを公開すれば対応する」とある | 英語圏/KR | https://github.com/SpiralMoon/maplestory.openapi |
| openapi.nexon.com のトップページのメタデータにあるプラットフォームは KR(krpc) / arena_sea / arena_tw / arena_west だけで、JPはない。お知らせ欄で名前が出ていたのはMapleStoryTaiwan(2026-09-02)のみ | KR公式 | https://openapi.nexon.com/ |
| JMS攻略のリンク集に「Nexon Open APIを叩けないJMSプレイヤーでもHEXA換算ができる」という記述がある | JP攻略 | https://mushroom-lab.com/reference/sites |
| 公式Open APIを使うキャラ検索サイト(メイプルGG、メアギ検索、CHUCHU.gg等)はKMS専用 | JP攻略 | 同上 |

### 1.2 JMS公式サイト(maplestory.nexon.co.jp)
- 今回の環境ではランキング系のURL(`/ranking/`、`/ranking/world/total/`)を取得できず、**中身は未確認**(サーバーエラー)。一方 `/gameguide/...` と `/notice/view/?alias=...` は取得できた。
- 以前からの仕様では、JMS公式ランキングに出るのは**順位・キャラ名・ワールド・職業・レベル(+経験値)程度**。装備・潜在・★は公式Webで見られない(KMSの「캐릭터 정보 조회」に相当する機能はない)。この点も**今回は一次確認できておらず、要確認**。
- マイページ(ログイン後)で装備を見られるという情報は見つからなかった。
- 公式サイトのURL形式: お知らせは `https://maplestory.nexon.co.jp/notice/view/?alias=<32桁hex>`、ガイドは `/gameguide/<分類>/<項目>/`(例 `/gameguide/growth/status/`、`/gameguide/shop/melmarket/`、`/gameguide/item/enhance/`)。

### 1.3 非公式手段
| 手段 | 内容 | 出典 |
|---|---|---|
| JMS向けのキャラ検索/装備閲覧サイト | **見つからなかった**(APIがないので作れない) | [JP攻略] mushroom-lab リンク集 |
| 計算機系サイト | shRoom計算機集 https://mushiawo.com/ 、紀伊店 https://kiiten.com/ (DB+シミュ)、きのこアーカイブ https://kinokohub.net/tools/main-stats-converter 、なんJwikiの「換算ジュスタッド」(KMS換算サイトの日本語版。ステータスは**手入力**) | [JP攻略] |
| WZ抽出 | WzComparerR2-JMS(JMSクライアントからアイテムID、名称、基本ステータス、潜在の文言を抜き出せる) → **アイテムマスタの作成**に使える | [JP攻略] https://github.com/HikariCalyx/WzComparerR2-JMS |

### 1.4 参考: KMS Nexon Open APIのレスポンス構造(JMSにAPIができた場合も同じ形式になる可能性が高い)
出典: SpiralMoon/maplestory.openapi のDTO(`js/src/maplestory/api/kms/dto/character/characterItemEquipment.ts` ほか) [KR公式APIの非公式クライアント]
- 流れ: `GET /maplestory/v1/id?character_name=` → `ocid` → `GET /maplestory/v1/character/{basic|stat|item-equipment|set-effect|symbol-equipment|hyper-stat|ability|ring-reserve-skill-equipment|...}?ocid=&date=`。認証ヘッダは `x-nxopen-api-key`。
- `character/item-equipment` のトップレベル: `character_gender, character_class, preset_no, item_equipment[], item_equipment_preset_1..3[], title, medal_shape, dragon_equipment[], mechanic_equipment[]`
- `item_equipment[]` の各要素:
  `item_equipment_part, item_equipment_slot(例: 모자/무기/반지1), item_name, item_icon, item_description, item_shape_name, item_shape_icon, item_gender,`
  `item_total_option, item_base_option, item_add_option(=追加オプション/炎), item_etc_option(=書), item_starforce_option, item_exceptional_option,`
  `potential_option_grade, potential_option_flag, potential_option_1..3(文字列 例 "STR : +12%"), additional_potential_option_grade, additional_potential_option_1..3,`
  `starforce(文字列), starforce_scroll_flag, scroll_upgrade, scroll_upgradeable_count, scroll_resilience_count, cuttable_count, golden_hammer_flag, equipment_level_increase, growth_exp, growth_level, soul_name, soul_option, special_ring_level(シードリングLv), date_expire, freestyle_flag`
- `*_option` オブジェクト共通のキー: `str, dex, int, luk, max_hp, max_mp, attack_power, magic_power, armor, speed, jump, boss_damage, ignore_monster_armor, all_stat, damage, equipment_level_decrease, max_hp_rate, max_mp_rate`
- **アイテムIDは返さない**(名前とアイコンURLだけ) → 本ツールでは名前→IDの対応表(WZ由来)を持つ。
- `character/stat` は `final_stat[{stat_name, stat_value}]` を返す。stat_name はステータスウィンドウの表示名(전투력, 최소/최대 스탯공격력, 데미지, 보스 몬스터 데미지, 최종 데미지, 방어율 무시, 크리티컬 확률/데미지, 재사용 대기시간 감소(초/%), STR/DEX/INT/LUK/HP, AP 배분 STR… 等。※具体的な名前の列挙はKMS APIの経験に基づくもので、今回DTOで確認したのはキー名 `stat_name/stat_value` だけ)。

### 1.5 結論: 個人用ツールで現実的な取得方法
1. **JSONインポート/エクスポート(主)**: 後述の `CharacterInput` 型で保存する。手入力フォームはこのJSONを編集するUIにする。KMS APIの形式に近いので、将来JMS APIが出ても変換が楽。
2. **手入力UI(必須)**: 部位ごとに「アイテム(名前で検索→WZ由来のマスタ)、★、潜在等級と3行、アディ等級と3行、追加オプション(項目ごとの数値)」を入れる。潜在はプルダウン(部位とLvで候補を絞る)。
3. **ステータスウィンドウの値を手入力(必須)**: 戦闘力、主ステ/副ステ(詳細画面の「基礎+%+未適用」)、攻撃力、ダメージ%、ボス%、最終ダメージ%、クリダメ%、防御率無視、クールタイム減少。装備を外さずに「その装備を除いた基礎値」を逆算するには、%ステの合計と未適用値が必要になる。
4. **スクショOCR(任意、後回し)**: JMSの装備ツールチップは定型なので、日本語OCR(Tesseract jpn / PaddleOCR / ブラウザならTesseract.js)+正規表現で「STR : +12%」形式の行を拾える。ただし誤認識への対策と確認UIが必要なので、v1は手入力+JSONとし、v2でOCRを追加するのが現実的。
5. スクレイピングで取れるデータがない(公式に装備情報を出していない)ので、自動取得はしない。

---

## 2. 戦闘力(JMS: 戦闘力 / KMS: 전투력)の計算式

### 2.1 KMS解析済みの式 [KR攻略]
出典: インベン「전투력 계산」(2025-06-23) https://www.inven.co.kr/board/maple/5974/5194278 、vortexgaming「전투력 심층해저분석」 https://vortexgaming.io/postdetail/155908 、thewiki https://thewiki.kr/w/메이플스토리%2F스탯 、[英語圏] https://maplestorywiki.net/w/Combat_Power
```
CP = floor(
    (4*主ステ最終 + 副ステ最終) / 100          // ① ステ項
  * floor(攻撃力 * (1 + 攻撃力%))              // ② 攻撃力項(魔法職は魔力)
  * (1 + ダメージ% + ボスダメージ%)             // ③ ダメージ項(合算)
  * (1.35 + クリティカルダメージ%)               // ④ クリダメ項(基礎1.35)
  * (1 + 最終ダメージ)                          // ⑤ 最終ダメ項
  * [武器定数補正] * [職業補正]                  // ⑥ 補正(下記)
)
主ステ最終 = floor( (AP主ステ + %適用固定値) * (1 + 主ステ%) ) + %未適用主ステ
副ステ最終 = 同様(副ステが2つある職は STR と DEX をそれぞれ計算して合算)
```
各項の定義と注意点:
- **クリダメ基礎1.35**: 通常のクリティカルは非クリの120〜150%の範囲で、その期待値が135%。表示上のクリダメ%(ハイパー、手袋潜在など)はこれに加算する [KR攻略 thewiki/vortex]。依頼文の「クリダメ基礎35%」は、この1.35の0.35部分のこと。
- **ダメージ/ボス%は合算**(1つの項)。**防御率無視、クリティカル率、クールタイム減少、バフ持続、属性耐性無視は戦闘力に入らない** [KR公式 https://maplestory.nexon.com/Guide/N23GameInformation/Articles/390 、KR攻略]。
- **最終ダメージの扱い**: KMS公式ガイドは「最終ダメージ」を計算要素に含めている [KR公式]。ただし解析では、スキル由来の最終ダメ(パッシブやバフ)は除外され、**装備由来のもの(ジェネシス武器の解放効果の+10%など)だけが入る**。インベンの式では「ジェネシス武器装備時110%、それ以外100%」。maplestorywiki の式は `(1+最終ダメ)/Π(1+スキル由来最終ダメ)`。
- **スキル由来のステータスは除外**: 0〜6次スキル、リンク、ギルドスキル、消費アイテムのバフ、画面右上のバフアイコン由来は除外。ペットのラベルセット効果は含む [KR攻略 vortex]。ハイパーステータス、ユニオン、シンボル、HEXAステータスは含む([JP攻略] note.com あれくさ 2026-01-05 も同じ構成)。
- **⑥ 武器補正**: 攻撃力項では、武器攻撃力を「同等強化の弓(基準武器)」の攻撃力に置き換える。基準の弓の基本攻撃力: デスティニー349 / ジェネシス318 / アーケイン276 / アブソル192 [英語圏 maplestorywiki]。式は `floor((攻撃力 + floor(弓基本攻/武器基本攻 - 1)*(武器基本攻+武器★攻)) * (1+攻撃力%))` の形。さらに**武器定数 / その職の最高武器定数**を掛ける(複数武器職の場合)。
- **⑥ 職業補正**: デーモンアヴェンジャーとゼノンには未公開の定数が掛かる [英語圏]。ゼロはβ(サブ武器)の基本ステなどが一部除外される。
- 丸め: ステの括弧内は切り捨て。最後に全体を切り捨て [KR攻略]。

### 2.2 JMSでの整合
- JMSのステータスウィンドウにも「戦闘力」が表示される。JMS攻略(note.com あれくさ、2026-01-05)の式は `戦闘力 = ステータス × 攻撃力 × ダメージ% × クリティカルダメージ% (× 最終ダメージ%)` で、防御率無視は反映されないと明記されており、KMSと同じ構成 [JP攻略] https://note.com/alelexir/n/n69bf525eb23a
- 「戦闘力はボスダメージを過大評価しがちで、火力指標としては水路スコアやHEXA換算のほうが確実」という指摘がある [JP攻略 Yahoo!知恵袋 2025-05-05] https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q14314572399
- JMS公式の「ステータス」ガイドには戦闘力の式は書かれていない [JP公式] https://maplestory.nexon.co.jp/gameguide/growth/status/
- **実装方針**: 絶対値は合わせにいかない。**ユーザーが入力した表示戦闘力CPを基準にした比率(差分)で推定する**(msuplanner方式)。比率で計算すれば、⑥の武器/職業補正や最終ダメージ項は分子と分母で打ち消し合う。

---

## 3. ステータス計算

### 3.1 主ステの一般式 [KR攻略/英語圏]
```
主ステ最終 = floor( (AP割り振り + %適用の固定値) × (1 + Σ主ステ%) ) + %未適用の固定値
  %適用の固定値: 装備の基本ステ、★、書、追加オプション、潜在の固定値、セット効果 など
  Σ主ステ%   : 潜在/アディの主ステ%、オールステ%(主ステ%に加算)、一部スキル
  %未適用    : シンボル(アーケイン/オーセンティック/グランドオーセンティック)、ハイパーステータス、ユニオン占領/ユニオンアーティファクト、HEXAステータス、レベル毎の潜在行(9Lvごと+1)
```
出典: biligame wiki https://wiki.biligame.com/maplestory/游戏伤害公式 (純/追加/%/最終の4区分)、KMSインベンの式。
- **装備1部位の寄与を外す**(差分計算の基礎): `base_flat_excl = 総固定値 - その装備の固定値`、`pct_excl = Σ% - その装備の%`。こうすることで、潜在%の1行を「その装備以外の基礎値」に掛けて実数に換算できる(msuplanner方式)。
- **ゲーム内の詳細ステータス表示**(JMS: ステータスウィンドウ「詳細」)では「AP」「基礎ステ」「%」「未適用」の数値を確認できる。換算ジュスタッドが求める入力項目もこの3値(基本値、%値、未適用値) [JP攻略 wikiwiki maplej]。

### 3.2 職業ごとの特例
| 職業 | ステ項 | 出典 |
|---|---|---|
| 標準 | 4×主ステ + 副ステ | [KR攻略 thewiki] |
| 副ステ2種(シャドー、デュアルブレイド、カデナ、カーリー、虎影) | 4×LUK + (STR + DEX) | [KR攻略 thewiki](シャドー、デュアルブレイド、カデナは明記あり。カーリーと虎影は一般的な理解で、要確認) |
| ゼノン | 4×(STR+DEX+LUK)(副ステなし) | [KR攻略 thewiki]、[英語圏 strategywiki] |
| デーモンアヴェンジャー | floor(純HP/3.5) + 0.8×floor(追加HP/3.5) + STR。純HPはAP由来(4次以降 90×Lv+545前後)。装備の固定HPは半分になる | [KR攻略 thewiki]、[英語圏/CN biligame] |
| 魔法職 | 攻撃力の代わりに魔力と魔力%を使う | 共通 |

職業リスト(日本語名、系統、主ステ/副ステ、攻撃力/魔力、武器係数の参考値)は **`/home/claude/research/40_jobs.json`(50職)** に保存した。日本語の職業名は [JP攻略] kawaii-sushi.com の「全50職比較」(https://kawaii-sushi.com/maplestory/job/class-ranking/)に準拠。

---

## 4. 帽子のクールタイム減少の価値

### 4.1 仕組み [KR攻略] インベン(2026-08-03) https://www.inven.co.kr/board/maple/2304/48082
- 帽子潜在の「スキルクールタイム -N秒」は複数行を合算できる(1秒×2行 = 2秒×1行)。
- 10秒以上のスキル: 1秒につき1秒短縮。10秒未満になる分は、1秒が**5%短縮**に変わる。キューブによる短縮では5秒未満にならない。メルセデスのユニオン効果(5%/6%)は先に掛かる。
- 価値の源は主に (a) 極ディール周期のずれ解消と回数増加(20分のボスで約10回 → 約11.5回)、(b) 主力スキルの使用回数増加。どの程度効くかは職業のスキル構成で決まる。

### 4.2 職業別の価値の目安
- **[KR攻略] インベン(2026-03-25)**: Lv290以上・換算9万以上のKMSキャラの職業別**平均クールタイム減少(秒)**。高スペック層がどれだけ採用しているかを価値の目安にできる。
  ダークナイト 4.90 / 火毒 4.76 / メカニック 4.78 / ファントム 4.80 / デュアルブレイド 4.66 / ウィンドシューター 4.44 / フレイムウィザード 4.31 / ワイルドハンター 4.31 / ルミナス 4.25 / カーリー 4.18 / カイザー 4.17 / カデナ 4.14 / アデル 4.07 / ゼロ 3.95 / パスファインダー 3.94 / エンジェリックバスター 3.56 / ゼノン 3.46 / レン 3.41 / シャドー 3.38 / ヒーロー 3.00 / 隠月 2.84 / パラディン 2.72 / キャノン 2.61 / エヴァン 2.56 / ミハエル 2.51 / アーク 2.49 / メルセデス 2.38 / キネシス 2.14 / カイン 2.13 / デーモンアヴェンジャー 2.11 / イリウム 2.10 / ソウルマスター 1.84 / ナイトウォーカー 1.77 / バトルメイジ 1.77 / ストライカー 1.75 / ララ 1.71 / ビショップ 1.69 / 氷雷 1.62 / キャプテン 1.48 / ナイトロード 1.47 / デーモンスレイヤー 1.46 / 虎影 1.44 / ブラスター 1.28 / バイパー 1.15 / アラン 0.72 / クロスボウマスター 0.64 / ボウマスター 0.62
  https://www.inven.co.kr/board/maple/5974/6404304
- **[英語圏/MSU] msuplanner**: 帽子のクールタイム減少を「レジェ潜在の主ステ最大値の行数」に換算する。例: ビショップ 0.5行、火毒 2.5行。設定は職業別の自動 / 考慮しない / 0.5〜2.5行から選べる(既存分析 `00_msu_site_analysis.md`)。
- **[JP攻略] 換算ジュスタッド**: 「クールタイム -2秒 ≒ 主ステ36%相当」という例がある(職業は不明)。https://wikiwiki.jp/maplej/換算ジュスタッド
- **実装の既定値案**: クールタイム1秒あたり k 行(レジェ主ステ行。Lv160以上の帽子は13%、未満は12%)とし、`k = clamp(0.1 × 平均クールタイム減少秒, 0.05, 0.6)` から作る。2秒なら、平均4.8秒の職で約1.0〜1.2行、平均0.6秒の職で約0.1〜0.2行。ユーザーが職業ごとに上書きできるようにする。クールタイム-1秒は主ステ%行と排他なので、潜在ステップの評価では「クールタイム行 = k×主ステ%行」として比較する。

---

## 5. シードリング(特殊スキルリング)のJMSでの扱い

### 5.1 名称(JMS)[JP公式/JP攻略]
リストレイントリング、コンティニュアスリング、**ウェポンバフ-S/D/I/Lリング**(依頼文の「ウェポンパフ」はJMSでは「ウェポンバフ」)、リスクテイカーリング、リングオブサム、クリティカルダメージリング、クライシス-HMリング、レベルバフ-S/D/I/Lリング、デュラビリティリング、アルティメイタムリング、クリティカルディフェンスリング、スイフトリング、ヘルスカットリング、マナカットリング、リミットリング、シールドスワップリング、クリシフトリング、スタンスシフトリング、タワーエンハンスリング、オーバーパスリング、リフレクティブリング、バーデンリフトリング、リカバーディフェンス/スタンスリング、クライシス-H/Mリング。
出典: NEW AGE告知 [JP公式] https://maplestory.nexon.co.jp/notice/view/?alias=c415a36695e84d64a227535668376c7d&id=update 、紀伊店 [JP攻略] https://kiiten.com/data/skill-ring 、wikiwiki mapleinm [JP攻略]

主な効果(最大Lvの値) [JP攻略 kiiten]: リストレイントは120秒周期で攻撃力・魔力+最大68%(研磨Lv6で85%)、コンティニュアスはボス攻撃時ダメージ+最大36%など(研磨Lv6で54%)、ウェポンバフは主武器の基本攻撃力の最大260%分の主ステ、リスクテイカーは攻撃力+最大30%、クリティカルダメージリングはクリダメ+最大20%。(kiitenの「メル」や研磨Lv6の記述がJMSの現行仕様かどうかは要確認。)

### 5.2 入手方法(JMS)
- **2023-12-13 NEW AGE(ver4.20)以降**: ザ・シードの「アリーシャのリングボックス」が出なくなり、代わりにシードポイントがもらえるようになった。リングは**ボスリングボックス**から入手する [JP公式 NEW AGE告知]。
| 箱(JMS名) | 主なドロップ元 [JP公式 2023-12] |
|---|---|
| 緑玉のボスリングボックス(下級) | スウN、デミアンN、スライムN、ルシードE/N、ウィルE/N、ダスクN、デュンケルN |
| 紅玉のボスリングボックス(中級) | スウH、デミアンH、ルシードH、ウィルH、真・ヒルラN |
| 黒玉のボスリングボックス(上級) | ダスクC、デュンケルH、スライムC、真・ヒルラH、セレンN |
| 白玉のボスリングボックス(最上級) | 暗黒の魔法使いH/EX、セレンH/EX、カロスC、カリーンN |
- ボスごとにドロップ率は違い、アイテムドロップ率増加が効く。リブートワールドでは個人報酬になる [JP公式]。KMSの推定では箱のドロップ率は約1〜2% [KR攻略 インベン 2024-05-10]。
- チャレンジャーズワールドでは、等級報酬の「チャレンジャーズ4レベルスキルリングチョイスクーポン」(リストレイントかコンティニュアスを選択)がある [JP攻略 nekonote2 2025-08]。
- 2024-12-11 CHASER(ver4.29)の告知でも4種の箱名を確認できる(白玉は「白玉のボスリングの箱」と表記) [JP公式] https://maplestory.nexon.co.jp/notice/view/?alias=03f2143dbea34fef856fff5f6966f5bb

### 5.3 レベル上げ
- **基本は箱から出たLvのまま**(Lv1〜4で固定)。上位Lvがほしければ箱を開け直すか、別の個体を手に入れる。
- **研磨(Lv4→5)**: 生命の研磨石とメルを使い、交換不可のリングだけが対象。研磨石1個で10%/5億メル、2個で20%/10億、3個で30%/20億、4個で40%/35億、5個で50%/50億 [JP公式 NEW AGE 2023-12]。2023-12時点で研磨できたのは、リストレイント、リスクテイカー、ウェポンバフ、リングオブサム、クリティカルダメージ。
- **Lv5→6**: 信念の研磨石を使う。[英語圏 maplestorywiki](GMS/KMS)では、Lv5以上はリストレイントとコンティニュアスだけとされている。[JP攻略 kiiten] にもLv6の研磨と費用(10%あたり2個/10億)の記載があるが、**JMSでの実装時期と現行仕様は要確認**。
- コンティニュアスリングのLv4以上を持つと、2つ目のリングスロット(アクティブ+パッシブ)が開放される [英語圏]。

### 5.4 箱の確率
- JMSの公開確率は**今回見つけられなかった**(JMS公式の確率ページを取得できず)。
- **[KR公式 → 英語圏 maplestorywikiに転載]** KMS公式の確率(https://maplestory.nexon.com/Guide/OtherProbability/bossRingBox/ringBoxBlackJade ほか)。maplestorywiki https://maplestorywiki.net/w/Boss_Ring_Box より:
| 箱 | Lv1 | Lv2 | Lv3 | Lv4 |
|---|---|---|---|---|
| 緑玉 | 50% | 41% | 9% | - |
| 紅玉 | 40% | 30% | 20% | 10% |
| 黒玉 | 25% | 25% | 30% | 20% |
| 白玉 | - | - | 65% | 35% |
| 生命(KMS/GMSのみ) | - | - | 30% | 70% |

  リングごとの確率(%、緑/紅/黒/白): リストレイント 2.11/6.92/12.5/14.29、コンティニュアス 同じ、ウェポンバフ(各ステ) 2.82/6.15/8.33/7.94、リスクテイカー、リングオブサム、クリダメ、アルティメイタム、クライシスHM 各 2.82/6.15/8.33/7.94、その他(緑のみ3.52、紅1.54)。
  → **JMSでも同じ値だと仮定し、設定値として上書きできるようにする**。

---

## 6. 強化コストを「メル」に統一するための換算

### 6.1 JMSのキューブ事情 [JP公式]
- 2024-05-22: **ブラックキューブとマスターアディショナルミラクルキューブの販売終了**。**メガキューブ**(潜在の自動再設定。適用するか選べる)と**ネオアディショナルキューブ**の販売を開始。ネオミラクルキューブは「ネオキューブ」に改名。使うたびに欠片が手に入り、欠片で交換できる品は従来と同じ。https://maplestory.nexon.co.jp/notice/view/?alias=91577beb83e3478d84d8eedf74ba12cc&id=all
- リブートワールドでは「各種キューブ交換券」をメルで買える(公式Xで、価格不具合のため一時販売停止という告知あり) [JP公式 X 2023-12]。
- ユニキューブ(1行再設定)は期間限定で再登場する [JP公式 X]。
- 2026年 CROWN: 追加オプションは統一UIで自動再設定でき、メル払いも可能。スターキャッチは廃止され、成功率ボーナスが常時適用される。破壊された装備は22★まで材料とメルで復旧できる。ただしいずれも [JP攻略 kawaii-sushi] の記述で、**JMSでの実装日は要確認**。https://kawaii-sushi.com/maplestory/event/crown-showcase/
- KMSでは2024年から潜在の再設定にメソを使う方式に移っている [英語圏 orangemushroom 2024-01-09]。**JMSにメルでの潜在再設定があるかは未確認**。

### 6.2 メル相場の参考 [JP公式/JP攻略]
- **メルマーケット**(2021-04-14実装): プレイヤー同士でメルとメイプルポイント(MP)を売買する取引所。1億メル単位(1〜10億)で、価格はプレイヤーが指定し、販売額から手数料1%が引かれる [JP攻略 4Gamer] https://www.4gamer.net/games/011/G001163/20210414104/ 、[JP公式] https://maplestory.nexon.co.jp/gameguide/shop/melmarket/ (取得失敗)
- 相場の目安: 「2026年6月時点で1億メル = 100MP以上」 [JP攻略 semicta 2026-07-04] https://www.semicta.com/earn_mesos/ 。1MPはおおむね1円なので、1億メル ≒ 100円強が目安。相場はよく動く。
- RMTは規約違反なので、RMTサイトの相場は使わない。
- **結論**: 現金アイテム(メガキューブ、ネオアディショナルキューブ、ホワイトアディショナル、黒い炎などのMP販売品)は、**ユーザーが入力する「1個あたりMP」×「メルマーケットのレート(メル/MP)」**でメルに換算する。両方とも設定画面で入力する。メルで買える品(リブートの交換券、スターフォース、CROWN以降のメル炎)はメル額をそのまま使う。既定値は「1億メル = 100MP」で、出典と日付を表示して手動更新とする。

---

## 7. 実装用最終仕様

### 7.1 入力データ型(TypeScript)
```ts
type Region = 'JMS';
type StatKey = 'STR'|'DEX'|'INT'|'LUK'|'HP';
type EquipSlot =
  | 'hat'|'top'|'bottom'|'overall'|'shoes'|'gloves'|'cape'|'belt'|'shoulder'
  | 'faceAcc'|'eyeAcc'|'earrings'|'pendant1'|'pendant2'|'ring1'|'ring2'|'ring3'|'ring4'
  | 'weapon'|'secondary'|'emblem'|'pocket'|'heart'|'badge'|'medal';
type PotentialGrade = 'none'|'rare'|'epic'|'unique'|'legendary';

/** 潜在/アディの1行。数値は正規化し、元の文言(JMS表記)も保持する */
interface PotLine {
  raw?: string;                 // 例 "STR : +12%"、"全てのスキルのクールタイム -2秒"
  key: 'statPct'|'allStatPct'|'statFlat'|'statPerLv'|'attPct'|'mattPct'|'attFlat'|'mattFlat'
     | 'dmgPct'|'bossPct'|'iedPct'|'critRate'|'critDmg'|'cdrSec'|'hpPct'|'mesoDrop'|'itemDrop'|'other';
  stat?: StatKey;               // statPct/statFlat/statPerLv用
  value: number;                // %は数値(12 = 12%)、秒は秒
}

/** 追加オプション(転生の炎)。KMS APIの item_add_option と同じキー */
interface FlameOption {
  str?: number; dex?: number; int?: number; luk?: number; max_hp?: number;
  attack_power?: number; magic_power?: number; all_stat?: number;   // all_stat は %
  boss_damage?: number; damage?: number; equipment_level_decrease?: number;
}

interface EquipItem {
  slot: EquipSlot;
  itemId: number;               // WZ(WzComparerR2-JMS)由来
  name: string;                 // JMS名
  itemLevel: number;            // 装備レベル(★上限、潜在候補、炎の段階の決定に使う)
  starforce: number;            // 現在の★
  starforceMax?: number;        // 装備ごとの上限(マスタから)
  isAmazingEnhance?: boolean;   // 驚きのスターフォース(星の数が別体系)
  potential:  { grade: PotentialGrade; lines: [PotLine?, PotLine?, PotLine?] };
  additional: { grade: PotentialGrade; lines: [PotLine?, PotLine?, PotLine?] };
  flame: FlameOption;           // 追加オプション
  scrollStats?: Partial<FlameOption>;   // 書(item_etc_option 相当)
  baseStats?: Partial<FlameOption>;     // 基本値(マスタから入れるので任意)
  specialRingLevel?: number;    // シードリング
  tradable?: boolean;           // 研磨可否の判定用
}

interface CharacterInput {
  version: 1; region: Region;
  name: string; world: string; level: number;
  jobId: string;                // 40_jobs.json の id
  displayedCP: number;          // ステータスウィンドウの戦闘力(差分推定の基準)
  stats: {                      // ステータスウィンドウ「詳細」の値。主ステ・副ステごと
    [K in StatKey]?: { ap: number; flat: number; pct: number; nonPct: number; total?: number };
  } & {
    pureHP?: number; addHP?: number;     // デーモンアヴェンジャー用
  };
  attack: { flat: number; pct: number };   // 魔法職は魔力
  dmgPct: number; bossPct: number; finalDmgPct: number;
  critRate: number; critDmgPct: number; iedPct: number; cdrSec: number;
  equips: EquipItem[];
  seedRings?: { name: string; level: number }[];
  settings: {
    melPerMP: number;            // 例 1e8/100 = 1,000,000 メル/MP
    cashPricesMP: Record<string, number>;   // 'megaCube','neoAddCube','whiteAddCube','blackFlame','eternalFlame' 等
    cdrLinesPerSec?: number;     // 帽子クールタイム1秒 = 主ステ何行分(未指定なら職業別の既定値)
    starCatch?: boolean;         // CROWN以降は廃止の可能性あり → 既定false
    safeguard?: number[];        // 破壊防止する段階
    includeCritDmgLines: boolean;
  };
}
```

### 7.2 戦闘力差分推定(擬似コード)
```text
# 前処理: 現在のキャラから「戦闘力の各因子」を作る
function factors(ch):
  job = JOBS[ch.jobId]
  S = statTerm(ch, job)                         # ステ項
  A = floor(ch.attack.flat * (1 + ch.attack.pct/100))
  D = 1 + (ch.dmgPct + ch.bossPct)/100
  C = 1.35 + ch.critDmgPct/100
  return {S, A, D, C}

function finalStat(s):  floor((s.ap + s.flat) * (1 + s.pct/100)) + s.nonPct

function statTerm(ch, job):
  switch job.statFormula:
    'standard':     4*Σ finalStat(main) + Σ finalStat(sub)       # 副ステが2つなら両方
    'xenon':        4*(finalStat(STR)+finalStat(DEX)+finalStat(LUK))
    'demonAvenger': floor(pureHP/3.5) + 0.8*floor(addHP/3.5) + finalStat(STR)

# 1ステップ(★+1、潜在の変更、炎の変更)を Δ に変換する
function delta(ch, item, change):
  Δ = {flat:{}, pct:{}, att:0, attPct:0, dmg:0, boss:0, cd:0, cdrSec:0}
  ★: starforceStatGain(item, from→to)       # 別ファイルの★テーブルから(固定値と攻撃力)
  潜在/アディ: (新しい3行 − 古い3行) を key ごとに集計
     statPct/allStatPct → Δ.pct[stat]       (allStat は主・副の両方)
     statPerLv          → Δ.nonPct[stat] += value * floor(ch.level/9)   # %未適用
     attFlat/attPct     → Δ.att / Δ.attPct
     dmgPct/bossPct/critDmg → そのまま
     cdrSec             → Δ.pct[main] += cdrSec * cdrLinesPerSec(job) * legendaryMainLine(item.itemLevel)
                           # クールタイム減少を主ステ%行に換算(戦闘力には出ないが、効率評価のため加える。UIで切替可)
  炎: (新しい値 − 古い値) → flat / att / boss / dmg / allStat(%)
  return Δ

function cpAfter(ch, Δ):
  f0 = factors(ch)
  ch' = apply(ch, Δ)     # stats[k].flat += Δ.flat[k]; stats[k].pct += Δ.pct[k]; nonPct += …; attack 等
  f1 = factors(ch')
  ratio = (f1.S/f0.S) * (f1.A/f0.A) * (f1.D/f0.D) * (f1.C/f0.C)
  return ch.displayedCP * ratio           # 補正⑥と最終ダメ項は比率で打ち消される
  # 武器の★/炎で攻撃力が変わる場合、本来は「弓換算」の補正があるが、比率計算では近似とする

# 効率評価
for each item, each candidate step s (★の次段、潜在の目標行、アディの目標行、炎の改善):
   gain = cpAfter(ch, delta(ch, item, s)) − ch.displayedCP
   cost = expectedCostMel(s)      # ★: 期待メル(破壊時は装備の再調達費を含む)
                                  # 潜在/アディ: 期待キューブ数 × (MP単価 × melPerMP)、またはメル単価
                                  # 炎: 期待個数 × 単価
   eff  = gain / cost
sort by eff desc → 上位から提示(四分位で色分け)。潜在ステップは「その等級の最小値の行が出る」と仮定(msuplannerと同じ)
```

### 7.3 未解決の事項(後続の調査で確認する)
- JMS公式ランキングの中身とURL(今回は取得に失敗した)。
- JMSでメルによる潜在の再設定があるか。メガキューブの価格と等級アップ確率。
- CROWNの改変(スターキャッチ廃止、メル炎)がJMSでいつ実装されたか(ver4.36 / 2025-09-17 の「スターフォース強化の改編」の本文も未取得)。
- JMSの白玉ボスリングボックスなどの公開確率。研磨Lv6のJMSでの実装状況。
- デーモンアヴェンジャーとゼノンの戦闘力補正定数(差分の比率計算では影響しない)。
