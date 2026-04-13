# Atelier Stock — CLAUDE.md

アクセサリー部品・完成品の在庫・仕入・売上・委託を管理するPWA。
個人ハンドメイド販売者向けのスマホ対応Webアプリ。

---

## 技術スタック

- **フレームワーク**: React 18（Vite）
- **スタイル**: CSS-in-JS（テンプレートリテラルでCSSを定義、`<style>` タグで注入）
- **状態管理**: React useState / useMemo のみ（外部ライブラリなし）
- **永続化**: LocalStorage（`useLS` カスタムフック）
- **ビルド**: Vite → `npm run build` で `dist/` を生成
- **デプロイ先**: Xserver（`dist/` の中身を `public_html/` 以下に配置）

---

## ファイル構成

```
src/
└── App.jsx   # アプリ全体（単一ファイル構成）
```

現時点では単一ファイル構成。機能追加時にコンポーネント分割を検討する場合は相談すること。

---

## 用語定義（UI表示名 ↔ コード内部値）

| UI表示 | コード内部値 | 意味 |
|--------|------------|------|
| 母材 | `type:"material"` | 加工前の素材（布・紐など）。仕入れで在庫増加 |
| 中間材 | `type:"part"` | 母材から切り出した部品。加工記録で在庫増加 |
| 通常 | `type:undefined` | 仕入れてそのまま使う部品 |
| 素材加工 | `subTab==="processing"` | 仕入・廃棄タブの加工記録サブタブ |
| 中間材の加工記録 | `modal==="processing"` | 加工記録登録モーダルのタイトル |

**コード内部値（`type` フィールドの文字列）は変えない。** UI上の表示文言のみ変更済み。

---

## モジュールレベルのユーティリティ

React Compiler の `react-hooks/purity` ルールにより、コンポーネント内で `Date.now()` などの不純な関数を直接呼び出すとエラーになる。以下のモジュールレベルのヘルパーを使うこと。

```js
let _idSeed = Date.now();
const nextId = () => ++_idSeed;          // ID生成（Date.now()の代替）
const today  = () => new Date().toISOString().slice(0,10); // "YYYY-MM-DD"
```

- **ID生成**: コンポーネント内では必ず `nextId()` を使う。`Date.now()` をコンポーネント関数内で直接使わない。
- **今日の日付**: `today()` を使う。フォームの日付初期値はすべて `today()` でデフォルト設定する。

---

## データ設計

すべてのデータは `App.jsx` 内の `INIT_*` 定数で初期値を定義し、`useLS`（LocalStorage フック）で永続化している。

### データ構造

```js
// 部品マスタ
{ id, cat, name, variant, unit, hinban, minStock, type, parentId? }
// minStock: 最低在庫数（未設定時は MIN_STOCK[id] || 10 にフォールバック）
// type: "material"（母材）| "part"（中間材）| undefined（通常の部品）
// parentId: type:"part" の場合に親の母材部品ID。品番は自動的に "{親の品番}-001" の連番で付与
// 例: "A布 1m" は type:"material"、"A布 1cm角" は type:"part", parentId=<A布のid>

// 仕入記録
{ id, partId, date, supplier, qty, unitPrice, note }
// ※ type:"part"（中間材）は仕入モーダルに表示しない

// 部品廃棄記録
{ id, partId, date, qty, reason }

// 加工記録（母材 → 中間材への変換）
{ id, date, inputPartId, inputQty, outputs:[{partId, qty}], lossQty, note }
// inputPartId: 母材の部品ID（type:"material" の部品）
// inputQty:    使用した母材の量（parseFraction で小数・分数・%を受け付ける）
// outputs:     切り出し後の部品IDと生成数量の配列（inputPartId の子中間材を先頭に表示）
// lossQty:     廃棄・端切れの量（parseFraction で小数・分数・%を受け付ける）
// note:        メモ
// 例: A布 0.5m → 1cm角×100枚 + 2cm角×25枚、ロス残り0.05m廃棄

// 部品使用記録（完成品制作時に生成）
{ id, madeId, partId, date, qty, type }
// type: "recipe" | "extra" | "loss"

// 完成品マスタ（レシピ）
{ id, name, desc, cat, ingredients:[{partId, qty}], shippingCost, laborCost }
// cat: 完成品のカテゴリ（ピアス・イヤリング・ネックレス等。任意・自由入力可）

// 制作記録（完成品在庫の源泉）
{ id, productId, date, qty, note }

// 委託先マスタ
{ id, name, address, memo }

// 委託記録
{ id, productId, consigneeId, date, type, qty, salePrice, feeRate, memo }
// type: "deliver" | "sale" | "return" | "loss"
// ※ 委託終了時は "return"（返品）または "loss"（廃棄ロス）を qty=現在委託在庫 で登録

// 売上記録
{ id, productId, date, channel, qty, price, shippingActual, memo, feeRate?, consignRecordId? }
// feeRate: 委託連動売上の場合に設定（chFeeMap より優先）
// consignRecordId: 委託記録から自動生成された売上に設定

// チャネルマスタ（動的管理）
{ id, name, feeRate, color }
```

### LocalStorageキー一覧

| キー | 内容 |
|------|------|
| `as_parts` | 部品マスタ |
| `as_purchases` | 仕入記録 |
| `as_disposals` | 部品廃棄記録 |
| `as_processings` | 加工記録 |
| `as_part_usages` | 部品使用記録（制作時） |
| `as_products` | 完成品マスタ |
| `as_made` | 制作記録 |
| `as_consignees` | 委託先マスタ |
| `as_consign_records` | 委託記録 |
| `as_sales` | 売上記録 |
| `as_channels` | チャネルマスタ |

---

## 在庫計算ロジック

### 部品在庫
```
// 母材（type:"material"）
母材在庫 = 仕入累計 - 加工記録のinputQty累計 - 廃棄累計

// 中間材（type:"part"）
中間材在庫 = 加工記録のoutputQty累計 - 制作時使用累計 - 廃棄累計

// 通常の部品（type:undefined）
部品在庫 = 仕入累計 - 廃棄累計 - 制作時使用累計

加重平均単価 = 仕入総額 / 仕入総数量（母材・通常部品のみ。中間材は母材の加重平均単価を按分）
```
→ `calcPartStock(partId, purchases, disposals, partUsages=[], processings=[])`

### 最低在庫数の解決
```
partMinStock(p) = p.minStock ?? MIN_STOCK[p.id] ?? 10
```
→ `partMinStock(p)` ヘルパー関数。部品ごとの `minStock` → 初期ハードコード `MIN_STOCK` → デフォルト10 の順でフォールバック。

### 完成品在庫（手元）
```
手元在庫 = 制作累計 - 直販売上累計 - 委託納品累計 + 委託返品累計
```
→ `calcProductStock(productId, made, sales, consignRecords)`

### 委託先在庫（委託先ごと × 商品ごと）
```
委託在庫 = 納品累計 - 委託売上累計 - 返品累計 - 廃棄ロス累計
```
→ `calcConsigneeStock(productId, consigneeId, records)`
- 委託在庫が 0 になると完成品在庫タブ・委託先一覧から表示が消える（`stock > 0` でフィルタ）

### 完成品原価
```
原価 = 材料費（加重平均単価 × 使用量）+ 梱包費 + 想定送料 + 人件費
```
→ `calcProductCost(product, partStockMap, parts)`

### 売上純利益
```
純利益 = 売上合計 - 原価 - チャネル手数料 - 送料実費
手数料率 = sale.feeRate ?? chFeeMap[sale.channel] ?? 0
```
→ `calcSaleProfit(sale, productCostMap, chFeeMap={})`
　`sale.feeRate` が設定されている場合は `chFeeMap` より優先（委託連動売上用）

---

## 画面構成（タブ）

| タブID | 表示名 | 内容 |
|--------|--------|------|
| `dashboard` | HOME | 今月KPI（クリックで売上タブへ遷移）・チャネル別売上棒グラフ・在庫アラート＋在庫補充/在庫作成ボタン |
| `parts` | 部品在庫 | 部品一覧（加重平均単価・仕入先・在庫ステータス）、母材の残量バー、母材→中間材の親子インデント表示、編集・＋で部品登録 |
| `prodstock` | 完成品 | カテゴリフィルタ＋ソート、サブタブ「在庫」「レシピ・原価」、レシピ編集・削除、＋で制作記録またはレシピ登録 |
| `records` | 仕入・廃棄 | サブタブ「仕入記録」「廃棄記録」「**素材加工**」「部品マスタ」、各記録の編集・削除。素材加工一覧は母材ごとにグループ表示 |
| `consign` | 委託 | 委託先ごとの記録履歴・商品別在庫サマリ、委託記録の編集・削除、売上計上ボタン・委託終了ボタン（返品/廃棄ロス選択） |
| `sales` | 売上 | 年度セレクト＋チャネルフィルター、売上記録の編集・削除、チャネルの編集・削除 |

---

## デザインルール

### カラーパレット（CSS変数）

```css
--bg: #faf8f5      /* ページ背景（温かみのあるオフホワイト） */
--sf: #ffffff      /* カード背景 */
--s2: #f4f1ec      /* サブ背景・展開エリア */
--bd: #e8e3da      /* ボーダー */
--tx: #2c2417      /* メインテキスト */
--t2: #8c7d6a      /* サブテキスト */
--ac: #c9773a      /* アクセント（テラコッタ） */
--gold: #d4a853    /* ロゴゴールド */
--low: #c94040     /* 警告・要発注 */
--warn: #b87d2a    /* 注意・少なめ */
--ok: #3a8c5a      /* 良好・利益プラス */
```

### フォント

- 見出し・数値: `DM Serif Display`（Google Fonts）
- 本文・UI: `Zen Kaku Gothic New`（Google Fonts）

### アイコン：FontAwesome Pro 5.15

FontAwesome Pro 5.15のファイル一式をプロジェクトに同梱して使う。CDNは使わない。

**ファイル配置**
```
public/
└── fontawesome/
    ├── css/
    │   └── all.min.css
    └── webfonts/
        ├── fa-solid-900.woff2
        ├── fa-regular-400.woff2
        ├── fa-light-300.woff2
        └── ... （その他のwebfontsファイル）
```

**index.htmlでの読み込み**
```html
<!-- index.html の <head> 内 -->
<link rel="stylesheet" href="/fontawesome/css/all.min.css">
```

**使い方（JSX内）**
```jsx
<i className="fas fa-box" />   // solid
<i className="far fa-box" />   // regular
<i className="fal fa-box" />   // light（Pro限定）
```

**スタイルの使い分け方針**
- `fas`（solid）: アクションボタン・FAB・重要な操作
- `fal`（light）: ナビアイコン・カード内の装飾
- `far`（regular）: 中間的な用途

**主要アイコン対応表**
| 用途 | アイコン |
|------|---------|
| ダッシュボード（HOME） | `fal fa-home` |
| 部品在庫 | `fal fa-boxes` |
| 完成品 | `fal fa-gem` |
| 仕入・廃棄 | `fal fa-truck` |
| 委託 | `fal fa-store` |
| 売上 | `fal fa-chart-line` |
| ＋追加（FAB） | `fas fa-plus` |
| 編集 | `fal fa-pen` |
| 削除 | `fal fa-trash` |
| 閉じる・キャンセル | `fal fa-times` |
| 展開（▼） | `fal fa-chevron-down` |
| 折りたたみ（▲） | `fal fa-chevron-up` |
| 在庫アラート | `fas fa-exclamation-triangle` |
| 在庫補充 | `fal fa-cart-plus` |
| 母材 | `fal fa-layer-group` |
| 中間材 | `fal fa-cut` |
| 加工記録 | `fal fa-scissors` |
| 委託終了 | `fal fa-flag-checkered` |
| メモ | `fal fa-sticky-note` |

### 部品マスタの親子関係（母材 ↔ 中間材）

- `type:"part"`（中間材）に `parentId` を設定すると、親の母材と連携
- 品番は親登録時に `{親の品番}-001` の連番で自動付与（手動変更可）
- 部品在庫一覧：母材の直下にその中間材をインデント表示（左ボーダー＋「↳ 親名 の中間材」ラベル）
- 仕入モーダル：`type:"part"`（中間材）の部品は選択不可（加工記録から在庫が増える）

### 素材加工（加工記録）の入力UX

母材の使用量・ロス量入力は「測りにくい単位」（m²・cm等）になるため、以下の補助UIを設ける。

**入力欄の仕様**
- 数値テキスト入力1つ（小数・分数・パーセント表記すべて受け付ける）
- `parseFraction(str)` ヘルパーで統一的にパース（モジュールレベルに定義）

```js
const parseFraction = (str) => {
  const s = String(str).trim();
  if (s.includes("/")) {
    const [a, b] = s.split("/").map(Number);
    return b !== 0 ? a / b : NaN;
  }
  if (s.endsWith("%")) return parseFloat(s) / 100;
  return parseFloat(s);
};
// 使用例: "1/3" → 0.333, "25%" → 0.25, "0.5" → 0.5
```

**チップボタン（割り算ショートカット）**
- 使用量: `[1/2]` `[1/3]` `[1/4]` `[1/5]` `[2/3]` `[3/4]` を横並びで表示
- ロス量: `[1/10]` `[1/20]` `[1/4]` `[1/5]` `[1/2]` `[3/4]` を横並びで表示
- タップすると入力欄に分数テキストをセット → 残量プレビューが即更新

**残量プレビュー**
- 母材選択 + 使用量入力のたびにリアルタイム表示
- `現在在庫 2.0m → 使用後 1.5m`
- 在庫が足りない場合は赤字で警告

**切り出し結果セレクト**
- 母材を選択すると、その母材の子中間材（`parentId` 一致）を optgroup で先頭に表示
- `<optgroup label="↳ この母材の中間材">` → `<optgroup label="その他の中間材">`

**母材カードの在庫表示**
- 数値に加えて割合バーを表示（仕入れ累計を100%として残量を視覚化）
- `████████░░  1.5m / 2.0m（75%）`

**素材加工一覧の表示**
- 母材IDでグループ化し、グループヘッダーに「{親素材名 →} {母材名} #品番 N件」を表示
- 親素材を持つ母材を先にソート（`parentId` 有→無の順）

### ダッシュボードの在庫アラートボタン

アラート部品の `type` によってボタンが切り替わる：

| 部品タイプ | ボタン | 色 | 動作 |
|-----------|--------|-----|------|
| 通常 / 母材（`type:undefined` or `"material"`） | 在庫補充 | アクセント（テラコッタ） | 仕入モーダルを開く（部品・カテゴリ自動セット） |
| 中間材（`type:"part"`） | 在庫作成 | グリーン（`--ok`） | 素材加工モーダルを開く（中間材・親の母材を自動セット） |

- `openReplenish(p)` → 仕入モーダル（`pf.partId` セット）
- `openStockCreate(p)` → 素材加工モーダル（`procForm.outputs[0].partId` にこの中間材、`procForm.inputPartId` に `p.parentId` をセット）

### 完成品カテゴリ

- `productCats` = `["ピアス","イヤリング","ネックレス","ブレスレット","リング","その他"]` ＋ 動的追加分
- レシピ登録モーダルでチップ選択（トグル：再タップで解除）または「＋ 新規」で自由入力
- 完成品在庫・レシピ一覧はカテゴリフィルタチップでフィルタ、カテゴリ名でアルファベットソート

### 委託終了フロー

1. 委託先詳細の現在庫カードに「委託終了」ボタン（赤枠）を表示（在庫 > 0 のみ）
2. タップすると `modal="consign_end"` が開く
3. 「返品」「廃棄ロス」を選択（デフォルト: 返品）、日付・数量（現在在庫で自動入力）・メモを入力
4. 記録すると `type:"return"` または `type:"loss"` の委託記録が追加され、委託在庫が減算
5. 在庫が 0 になると完成品在庫タブの委託先表示・委託先一覧から消える（`stock > 0` フィルタ）

### UIパターン

- カードをタップ → 詳細展開（`open` state で管理、キー: `ps{id}` `rc{id}` `s{id}` `cn{id}`）
- 展開エリア内に編集ボタンを配置（仕入・廃棄・売上・レシピ）
- モーダルはボトムシート形式（`animation: slideUp`）
- FAB（右下固定ボタン）でデータ追加
- 在庫ステータス: `low`（要発注）/ `warn`（少なめ）/ `ok`（良好）をカード左ボーダー色で表現
- 削除ボタンは `.btn-d` クラス（赤系）、編集モーダルの下部に配置
- チップボタン: `.chip` / `.chip.on` クラス

---

## 定数・設定

```js
// チャネル初期値（as_channels に保存、動的に追加・編集・削除可能）
INIT_CHANNELS = [
  { id:1, name:"Minne",  feeRate:10,  color:"#e8847a" },
  { id:2, name:"Creema", feeRate:10,  color:"#7ab5e8" },
  { id:3, name:"BASE",   feeRate:6.6, color:"#8ae8a8" },
  { id:4, name:"実店舗", feeRate:0,   color:"#e8c87a" },
]
CH_PALETTE = ["#e8847a","#7ab5e8",...]  // チャネル追加時の自動カラー割り当て

// 部品タイプ（コード内部値 ← UI表示との対応は「用語定義」セクション参照）
// type:"material" → 母材（布・紐など仕入れ単位のまま保管するもの）
//                   在庫計算: 仕入累計 - 加工記録inputQty累計 - 廃棄累計
// type:"part"     → 中間材（切り出し後のサイズ単位で管理するもの）
//                   在庫計算: 加工記録outputQty累計 - 制作時使用累計 - 廃棄累計
//                   parentId に親の母材IDを設定可能
// type:undefined  → 通常の部品（従来通り。仕入れ→そのまま使用）

// 完成品カテゴリ（動的。productCats useMemo で管理）
PRODUCT_CATS_BASE = ["ピアス","イヤリング","ネックレス","ブレスレット","リング","その他"]

// 部品の最低在庫数（初期10件分のフォールバック用ハードコード）
// 新規登録部品は part.minStock フィールドで個別管理
MIN_STOCK = { 1:50, 2:50, 3:100, 4:30, 5:5, 6:10, 7:80, 8:20, 9:100, 10:50 }
```

---

## 開発コマンド

```bash
npm run dev      # 開発サーバ起動（http://localhost:5173）
npm run build    # 本番ビルド → dist/ に出力
npm run preview  # ビルド結果をローカルで確認
```

---

## デプロイ手順（Xserver）

1. `npm run build` を実行
2. `dist/` の中身をすべて FTP で `public_html/` 以下にアップロード
3. サブディレクトリに置く場合は `vite.config.js` に `base: '/サブディレクトリ名/'` を追加してから再ビルド

---

## 今後の課題・未実装

### 機能面
- データのエクスポート・バックアップ機能（JSON出力など）
- 月次レポートの期間切り替え（ダッシュボードは現在月固定）
- 制作記録の編集・削除（現状は追加のみ）

### インフラ面（将来）
- **Supabase移行**：現状LocalStorageのみ。複数端末同期・データ永続化のためSupabase（PostgreSQL）へ移行予定。移行時は `useLS` フックをSupabase APIクライアントに差し替える形を想定