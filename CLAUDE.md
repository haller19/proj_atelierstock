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
{ id, cat, name, variant, unit, hinban, minStock }
// minStock: 最低在庫数（未設定時は MIN_STOCK[id] || 10 にフォールバック）

// 仕入記録
{ id, partId, date, supplier, qty, unitPrice, note }

// 部品廃棄記録
{ id, partId, date, qty, reason }

// 部品使用記録（完成品制作時に生成）
{ id, madeId, partId, date, qty, type }
// type: "recipe" | "extra" | "loss"

// 完成品マスタ（レシピ）
{ id, name, desc, ingredients:[{partId, qty}], shippingCost, laborCost }

// 制作記録（完成品在庫の源泉）
{ id, productId, date, qty, note }

// 委託先マスタ
{ id, name, address, memo }

// 委託記録
{ id, productId, consigneeId, date, type, qty, salePrice, feeRate, memo }
// type: "deliver" | "sale" | "return" | "loss"

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
部品在庫 = 仕入累計 - 廃棄累計 - 制作時使用累計
加重平均単価 = 仕入総額 / 仕入総数量
```
→ `calcPartStock(partId, purchases, disposals, partUsages=[])`

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
| `dashboard` | HOME | 今月KPI（クリックで売上タブへ遷移）・チャネル別売上棒グラフ（クリックでフィルター遷移）・在庫アラート |
| `parts` | 部品在庫 | 部品一覧（加重平均単価・仕入先・在庫ステータス）、編集・＋で部品登録 |
| `prodstock` | 完成品 | サブタブ「在庫」「レシピ・原価」、レシピ編集・削除、＋で制作記録またはレシピ登録 |
| `records` | 仕入・廃棄 | サブタブ「仕入記録」「廃棄記録」「部品マスタ」、各記録の編集・削除 |
| `consign` | 委託 | 委託先ごとの記録履歴・商品別在庫サマリ、委託記録の編集・削除、売上計上ボタン |
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

### UIパターン

- カードをタップ → 詳細展開（`open` state で管理、キー: `ps{id}` `rc{id}` `s{id}` `cn{id}`）
- 展開エリア内に編集ボタンを配置（仕入・廃棄・売上・レシピ）
- モーダルはボトムシート形式（`animation: slideUp`）
- FAB（右下固定ボタン）でデータ追加
- 在庫ステータス: `low`（要発注）/ `warn`（少なめ）/ `ok`（良好）をカード左ボーダー色で表現
- 削除ボタンは `.btn-d` クラス（赤系）、編集モーダルの下部に配置

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
- **GitHub Actions → Xserver 自動デプロイ**：SSH+SCP方式で構築予定。Secretsは `XSERVER_HOST` / `XSERVER_USER` / `XSERVER_KEY_B64` / `XSERVER_REMOTE_PATH` を使う
- **Supabase移行**：現状LocalStorageのみ。複数端末同期・データ永続化のためSupabase（PostgreSQL）へ移行予定。移行時は `useLS` フックをSupabase APIクライアントに差し替える形を想定
