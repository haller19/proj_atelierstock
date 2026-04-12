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

## データ設計

すべてのデータは `App.jsx` 内の `INIT_*` 定数で初期値を定義し、`useLS`（LocalStorage フック）で永続化している。

### データ構造

```js
// 部品マスタ
{ id, cat, name, variant, unit, hinban }

// 仕入記録
{ id, partId, date, supplier, qty, unitPrice, note }

// 部品廃棄記録
{ id, partId, date, qty, reason }

// 完成品マスタ（レシピ）
{ id, name, desc, ingredients:[{partId, qty}], shippingCost, laborCost }

// 制作記録（完成品在庫の源泉）
{ id, productId, date, qty, note }

// 委託先マスタ
{ id, name, address, memo }

// 委託記録
{ id, productId, consigneeId, date, type, qty, salePrice, feeRate, memo }
// type: "deliver" | "sale" | "return" | "loss"

// 売上記録（直販）
{ id, productId, date, channel, qty, price, shippingActual, memo }
```

### LocalStorageキー一覧

| キー | 内容 |
|------|------|
| `as_parts` | 部品マスタ |
| `as_purchases` | 仕入記録 |
| `as_disposals` | 部品廃棄記録 |
| `as_products` | 完成品マスタ |
| `as_made` | 制作記録 |
| `as_consignees` | 委託先マスタ |
| `as_consign_records` | 委託記録 |
| `as_sales` | 売上記録 |

---

## 在庫計算ロジック

### 部品在庫
```
部品在庫 = 仕入累計 - 廃棄累計
加重平均単価 = 仕入総額 / 仕入総数量
```
→ `calcPartStock(partId, purchases, disposals)`

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
```
→ `calcSaleProfit(sale, productCostMap)`

---

## 画面構成（タブ）

| タブID | 表示名 | 内容 |
|--------|--------|------|
| `dashboard` | ダッシュ | 今月KPI・チャネル別売上棒グラフ・在庫アラート |
| `parts` | 部品在庫 | 部品一覧（加重平均単価・仕入先・在庫ステータス）、＋で部品登録 |
| `prodstock` | 完成品 | サブタブ「在庫」「レシピ・原価」、＋で制作記録またはレシピ登録 |
| `records` | 仕入・廃棄 | サブタブ「仕入記録」「廃棄記録」、＋で各記録追加 |
| `consign` | 委託 | 委託先ごとの記録履歴・商品別在庫サマリ、＋で委託記録追加 |
| `sales` | 売上 | 直販売上一覧・損益明細、＋で売上登録 |

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
- モーダルはボトムシート形式（`animation: slideUp`）
- FAB（右下固定ボタン）でデータ追加
- 在庫ステータス: `low`（要発注）/ `warn`（少なめ）/ `ok`（良好）をカード左ボーダー色で表現

---

## 定数・設定

```js
// チャネル手数料率（%）
CH_FEE = { Minne:10, Creema:10, BASE:6.6, 実店舗:0 }

// 部品の最低在庫数（アラートライン）
MIN_STOCK = { 1:50, 2:50, 3:100, 4:30, 5:5, 6:10, 7:80, 8:20, 9:100, 10:50 }
// ※ 新規登録部品は MIN_STOCK に含まれないため、デフォルト10で処理される
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
- `MIN_STOCK` が初期10件分のハードコードになっている → 部品登録時に最低在庫数を設定できるようにしたい
- データのエクスポート・バックアップ機能（JSON出力など）
- 月次レポートの期間切り替え（現状は `THIS_MONTH` がハードコード）

### インフラ面（将来）
- **GitHub Actions → Xserver 自動デプロイ**：stock-roomと同じSSH+SCP方式で構築予定。Secretsは `XSERVER_HOST` / `XSERVER_USER` / `XSERVER_KEY_B64` / `XSERVER_REMOTE_PATH` を使う
- **Supabase移行**：現状LocalStorageのみ。複数端末同期・データ永続化のためSupabase（PostgreSQL）へ移行予定。zaiko（在庫管理）での実績あり。移行時はLocalStorageの `useLS` フックをSupabase APIクライアントに差し替える形を想定