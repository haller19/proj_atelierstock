# Atelier Stock — CLAUDE.md

アクセサリー部品・作品の在庫・仕入・売上・委託を管理するPWA。
個人ハンドメイド販売者向けのスマホ対応Webアプリ。

---

## 技術スタック

- **フレームワーク**: React 18（Vite）
- **スタイル**: CSS-in-JS（テンプレートリテラルでCSSを定義、`<style>` タグで注入）
- **状態管理**: React useState / useMemo / useEffect / useRef（外部ライブラリなし）
- **永続化**: LocalStorage（`useLS` カスタムフック）をキャッシュとして使用
- **クラウド同期**: Google Drive（オプション。`VITE_DRIVE_CLIENT_ID` 設定時に有効）
- **ビルド**: Vite → `npm run build` で `dist/` を生成
- **デプロイ先**: Xserver（`dist/` の中身を `public_html/` 以下に配置）

---

## ファイル構成

```
src/
└── App.jsx      # アプリ全体（単一ファイル構成）
.env.local       # Google Drive クライアントID（Git管理外 *.local）
.env.example     # .env.local のテンプレート（Git管理対象）
```

現時点では単一ファイル構成。機能追加時にコンポーネント分割を検討する場合は相談すること。

---

## 用語定義（UI表示名 ↔ コード内部値）

| UI表示 | コード内部値 | 意味 |
|--------|------------|------|
| 母材 | `type:"material"` | 加工前の素材（布・紐など）。仕入れで在庫増加 |
| 中間材 | `type:"part"` | 母材から切り出した部品。加工記録で在庫増加 |
| 通常 | `type:undefined` | 仕入れてそのまま使う部品 |
| 素材加工 | `tab==="records"` | ナビタブ「素材加工」。加工記録のみ表示（サブタブなし） |
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
{ id, partId, date, supplier, qty, totalPrice, unitPrice, note }
// totalPrice: 実購入額（税込・円）。会計帳簿用。UI表示は「部品数量」
// unitPrice:  税抜単価 = Math.round(totalPrice / qty / 1.1 * 100) / 100（原価計算用）
// 旧レコード（totalPrice未設定）は openEditPurchase で qty * unitPrice * 1.1 に自動換算
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

// 部品使用記録（作品制作時・受注売上時に生成）
{ id, madeId?, saleId?, partId, date, qty, type }
// type: "recipe" | "extra" | "loss"  ← 制作時
// type: "order"                       ← 受注売上（saleId セット、madeId なし）
// madeId: 制作記録ID（type:"recipe"|"extra"|"loss" のとき）
// saleId: 売上記録ID（type:"order" のとき）

// 作品マスタ（レシピ）
{ id, name, desc, cat, ingredients:[{partId, qty}], shippingCost, laborCost }
// cat: 作品のカテゴリ（ピアス・イヤリング・ネックレス等。任意・自由入力可）

// 制作記録（作品在庫の源泉）
{ id, productId, date, qty, note }

// 委託先マスタ
{ id, name, address, memo }

// 委託記録
{ id, productId, consigneeId, date, type, qty, salePrice, feeRate, memo }
// type: "deliver" | "sale" | "return" | "loss"
// ※ 委託終了時は "return"（返品）または "loss"（廃棄ロス）を qty=現在委託在庫 で登録

// 売上記録
{ id, saleType?, productId?, orderName?, date, channel, qty, price, shippingActual, memo, feeRate?, consignRecordId? }
// saleType: undefined（通常の作品売上）| "order"（受注・オーダー品）
// productId: saleType!=="order" のとき設定
// orderName: saleType==="order" のとき設定（商品名を自由入力）
// feeRate: 委託連動売上の場合に設定（chFeeMap より優先）
// consignRecordId: 委託記録から自動生成された売上に設定
// ※ 受注売上時に使用した部品は partUsages（type:"order", saleId）で追跡

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
| `as_products` | 作品マスタ |
| `as_made` | 制作記録 |
| `as_consignees` | 委託先マスタ |
| `as_consign_records` | 委託記録 |
| `as_sales` | 売上記録 |
| `as_channels` | チャネルマスタ |
| `as_part_cats` | 部品カテゴリマスタ（管理設定で編集・削除可能） |
| `as_product_cats` | 作品カテゴリマスタ（管理設定で編集・削除可能） |
| `as_drive_file_id` | Google Drive ファイルID（同期済みファイルの再利用に使用） |
| `as_local_saved_at` | ローカルデータの最終保存日時（Drive と Local の新旧比較用） |
| `as_drive_token` | Google OAuth アクセストークンキャッシュ（`{tok, exp}` JSON、約58分有効） |
| `as_drive_autosignin` | 前回サインイン済みフラグ（起動時の自動再接続トリガー。サインアウト時に削除） |
| `as_global_settings` | 全体設定（`{ avgPriceTax: "excl" \| "incl" }`）。管理設定→全体設定で変更 |

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

### 作品在庫（手元）
```
手元在庫 = 制作累計 - 直販売上累計 - 委託納品累計 + 委託返品累計
```
→ `calcProductStock(productId, made, sales, consignRecords)`

### 委託先在庫（委託先ごと × 商品ごと）
```
委託在庫 = 納品累計 - 委託売上累計 - 返品累計 - 廃棄ロス累計
```
→ `calcConsigneeStock(productId, consigneeId, records)`
- 委託在庫が 0 になると作品在庫タブ・委託先一覧から表示が消える（`stock > 0` でフィルタ）

### 作品原価
```
原価 = 材料費（加重平均単価 × taxMult × 使用量）+ 梱包費 + 想定送料 + 人件費
taxMult = globalSettings.avgPriceTax==="incl" ? 1.1 : 1
```
→ `calcProductCost(product, partStockMap, parts, taxMult=1)`

### 売上純利益
```
純利益 = 売上合計 - 原価 - チャネル手数料 - 送料実費

// 作品売上: 原価 = productCostMap[productId].total × qty
// 受注売上: 原価 = orderSaleCostMap[saleId]（使用部品の avgPrice × taxMult × qty の合計）
手数料率 = sale.feeRate ?? chFeeMap[sale.channel] ?? 0
```
→ `calcSaleProfit(sale, productCostMap, chFeeMap={}, partsCost=0)`
　`sale.feeRate` が設定されている場合は `chFeeMap` より優先（委託連動売上用）
　`partsCost`：受注売上の部品原価（`orderSaleCostMap[sale.id]||0` を渡す）

---

## 画面構成（タブ）

| タブID | 表示名 | アイコン | 内容 |
|--------|--------|---------|------|
| `dashboard` | HOME | `fal fa-home` | 今月KPI（クリックで売上タブへ遷移）・チャネル別売上棒グラフ・在庫アラート＋在庫補充/在庫作成ボタン |
| `parts` | 部品在庫 | `fal fa-boxes` | 部品一覧（加重平均単価・仕入先・在庫ステータス）、母材の残量バー、母材→中間材の親子インデント表示。カード内「仕入」「廃棄」ボタン。タイトル右に「履歴参照」ボタン。FABで部品追加/仕入のデュアルタブモーダル。**カードビュー/テーブルビュー切り替え対応**（テーブルビューはインライン編集・Tab移動・最終行から新規部品追加が可能） |
| `prodstock` | 作品 | `fal fa-gem` | カテゴリフィルタ＋ソート、サブタブ「在庫」「レシピ・原価」、レシピ編集・削除、＋で制作記録またはレシピ登録 |
| `records` | 素材加工記録 | `fal fa-cut` | 加工記録一覧のみ（サブタブなし）。母材ごとにグループ表示。FABで加工記録登録 |
| `consign` | 委託 | `fal fa-store` | 委託先ごとの記録履歴・商品別在庫サマリ、委託記録の編集・削除、売上計上ボタン・委託終了ボタン（返品/廃棄ロス選択） |
| `sales` | 売上 | `fal fa-chart-line` | 年度セレクト＋チャネルフィルター、売上記録の編集・削除、チャネルの編集・削除 |

### グローバルナビ（管理設定）

ヘッダー右端に「管理設定」ドロップダウンボタン（`fal fa-cog`）を配置。選択すると `mgmtPage` state が変わりフルページで表示。

| mgmtPage | 内容 |
|----------|------|
| `global_setting` | 全体設定（`fal fa-sliders-h`）。加重平均単価の税表示切替（税抜き/税込み）。原価計算にも反映 |
| `parts_master` | 部品マスタ一覧（全件表示）＋部品追加ボタン |
| `category_setting` | 部品カテゴリ（`as_part_cats`）と作品カテゴリ（`as_product_cats`）の追加・削除 |
| `data_manage` | JSON/CSV エクスポート・インポート |
| `history` | 仕入記録・廃棄記録の一覧参照 |

---

## デザインルール

### デザインシステム：Material Design 3（MD3）

テラコッタ（#9C4A23）をシードカラーとしたMD3ライトスキームを採用。

#### MD3トークン（CSS変数）

```css
/* Primary（テラコッタ） */
--md-p:   #9C4A23   /* Primary */
--md-op:  #FFFFFF   /* On Primary */
--md-pc:  #FFDBC9   /* Primary Container */
```

---

## ダッシュボード・グラフ設計規約

> デジタル庁「ダッシュボードデザインの実践ガイドブック」（2026年3月31日版）に基づく。
> HOMEタブのKPIカード・チャネル別売上グラフ・在庫アラート等を実装・改修する際は必ずこの規約を参照すること。

### レイアウト原則

- **左上 → 右下** の視線の流れ：左上＝全体KPI、右下＝詳細グラフ
- フィルターは**上部か左部**に配置し、影響する情報をその下・右に置く
- 全体を表す指標を最初に提示し、その後に詳細グラフを配置する
- 比較対象（目標値・前月比・前年比）を数値と一緒に表示する

### グラフ選択基準

| 用途 | 推奨グラフ | 注意点 |
|---|---|---|
| 売上の時間変化・傾向 | 折れ線グラフ | 横軸は必ず時間軸 |
| チャネル別・月別の数量比較 | 棒グラフ | 原点は必ず 0 |
| 売上構成比（チャネル割合など） | 円グラフ or 積み上げ棒 | 多くの場合は棒グラフが正確 |
| 在庫ステータスの傾向 | 折れ線グラフ | 閾値ラインを目標値として併記 |

### グラフ設計ルール

**必須：**
- 棒グラフの原点は**必ず 0** にする（途中から始めて差を誇張しない）
- グラフと凡例を**隣接させ、順番を対応づける**
- タイトルにグラフ内容とデータ種別（月次・累計など）を記載する
- データの更新日・集計基準日を明記する

**色使い：**
- グラフの色数は**1〜5色**に絞る
- チャネル色は `as_channels` の `color` フィールドを使用し一貫性を保つ
- **色のみで系列を識別しない**（ラベルや凡例を必ず併記する）
- 在庫ステータス：`low`（要発注）= Error色 / `warn`（少なめ）= Warning色 / `ok`（良好）= Success色

**避けること：**
- 3D グラフ・ドロップシャドウなど数値と無関係な装飾
- 意味のない順番（あいうえお順など）での並べ方
- 全体KPIなしに詳細グラフだけを表示する構成

### KPIカードの原則

- **今月の全体数値**（売上合計・制作数・在庫数）を最上位に表示
- 前月比・前年比などの**比較対象を必ず併記**する
- クリックで詳細タブへ遷移できる導線を設ける（現状の実装を維持）

---

## 実装ルール（部品在庫タブ）

### 部品カテゴリフィルタ・ソートロジック

- `filteredParts` useMemo でフィルタ。中間材は直接フィルタ対象だが、**親の母材がフィルタに含まれる場合は親経由で挿入**（重複なし）
- 親が非表示の「孤立中間材」は末尾に追加し、`isChild:true` で表示

**並び順**（`partSort` + `partSortDir` state）
- `partSort`: `"name"` | `"stock"` | `"update"`
- `partSortDir`: `"asc"` | `"desc"`（昇順/降順トグル）
- **ソート対象は母材・通常のみ**。中間材はソートから除外し、`filteredParts` は `[...topLevel, ...orphans]` の順で返す
- レンダリング時に母材の子中間材を **同じ基準・同じ方向でソートして直後に挿入**

**レンダリングロジック（`tableRows` useMemo）**

カードビューとテーブルビューの両方で共用する `tableRows` useMemo（`{p, isChild}[]`）に抽出。

```js
// filteredParts は母材+通常（ソート済み）+ 孤立中間材 の順
filteredParts.forEach(p => {
  if(p.type==="material") {
    rows.push({p, isChild:false});
    parts.filter(c=>c.type==="part"&&c.parentId===p.id)
         .sort(childSortFn)  // 同じ基準でソート
         .forEach(child => rows.push({p:child, isChild:true}));
  } else if(p.type==="part" && p.parentId) {
    rows.push({p, isChild:true});  // 孤立中間材
  } else {
    rows.push({p, isChild:false}); // 通常
  }
});
```

### 部品テーブルビュー（インライン編集）

部品在庫タブはカードビュー（`partView="card"`）とテーブルビュー（`partView="table"`）を切り替えられる。テーブルビューはスプレッドシートライクなインライン編集に対応。

**state・定数**

| 名前 | 型 | 説明 |
|------|---|------|
| `TABLE_EDIT_COLS` | `string[]`（モジュール定数） | 編集可能列のキー順: `["cat","name","variant","unit","hinban","minStock","location"]` |
| `partView` | `"card"` \| `"table"` | ビュー切替。切替時に `editCell` / `rowDraft` をリセット |
| `editCell` | `{id:number\|"new", col:string}` \| `null` | 現在アクティブなセル。`id:"new"` は新規追加行 |
| `rowDraft` | `{[id]: editFields}` | 編集中の行データ（未コミット）。`id` は部品IDまたは `"new"` |
| `editInputRef` | `useRef` | アクティブなセルの input/select にフォーカスするref。`editCell` 変化時に `useEffect` で自動フォーカス |
| `tableTabbing` | `useRef(false)` | Tab キー操作中フラグ。Tab の `onKeyDown` → `onBlur` 二重コミットを防ぐ |

**テーブル列構成（左→右）**

| 列キー | ヘッダー | 入力種別 | 備考 |
|--------|---------|---------|------|
| -      | （空）   | 読取専用 | 在庫ステータスインジケーター（左4px色帯） |
| `cat` | カテゴリ | `<select>` | `partCats` から選択 |
| `name` | 名前 | テキスト | 中間材は20px左インデント |
| `variant` | バリアント | テキスト | |
| `unit` | 単位 | テキスト | |
| `hinban` | 品番 | テキスト | |
| `minStock` | 最低在庫 | 数値 | |
| `location` | 保管場所 | `<select>` | `partLocMaster` から選択 |
| - | 現在庫 | 読取専用 | `fmtStock(stock)` |
| - | 加重平均単価 | 読取専用 | `¥{fmtD(applyAvgTax(avgPrice))}` |
| - | （空） | - | 仕入/加工・詳細編集ボタン |

**キーボード操作**

| キー | 動作 |
|-----|------|
| Tab | コミットして右のセルへ。最終列なら次行先頭へ。最終行最終列なら新規追加行へ |
| Shift+Tab | コミットして左のセルへ。先頭列なら前行の最終列へ |
| Enter | コミットして `editCell` をクリア |
| Escape | 変更を破棄して `editCell` をクリア |
| blur（フォーカス離脱） | `tableTabbing` が false のときコミット（Tab 移動中はスキップ） |

**新規追加行**

- `id="new"` の特殊行。表の最終行に常に表示
- 名前セルに「＋ 新規追加」プレースホルダーを表示
- Tab で最終行最終列から遷移、またはセルをクリックして編集開始
- コミット時に `commitTableRow("new")` が `nextId()` で新しい部品IDを生成し `parts` に追加
- カテゴリが `partCats` にない場合は自動的に `partCats` に追加
- コミット後は `editCell` を `{id:newId, col:"cat"}` に移動し連続入力を維持

**関連関数**

| 関数 | 説明 |
|------|------|
| `startTableEdit(id, col, partData)` | `rowDraft[id]` を初期化し `editCell` をセット |
| `commitTableRow(id)` | `rowDraft[id]` を `parts` にコミット（`"new"` なら追加） |
| `handleTableKey(e, id, col, rowIdx)` | Tab / Enter / Escape のキーハンドラ |
| `handleTableBlur(id)` | blur 時コミット（`tableTabbing` フラグで Tab 移動中はスキップ） |
| `renderTCI(id, col, val, rowIdx)` | 列に応じた `<input>` または `<select>` を返す |

**CSSクラス一覧（`App.css`）**

| クラス | 用途 |
|------|------|
| `.pt-vbtn` / `.pt-vbtn.on` | ビュー切替ボタン（カード/テーブル） |
| `.pt` | テーブル本体（`border-collapse:collapse`） |
| `.pt-th` / `.pt-ro-h` | ヘッダーセル / 読取専用ヘッダー（Primary色） |
| `.pt-tr` / `.pt-tr-e` / `.pt-tr-nr` | 行 / 編集中行 / 新規追加行 |
| `.pt-st` / `.pt-st.low` / `.pt-st.warn` / `.pt-st.ok` | 在庫ステータス帯 |
| `.pt-td` / `.pt-td-nr` / `.pt-ro` / `.pt-act` | セル / 新規追加セル / 読取専用セル / アクションセル |
| `.pt-cv` / `.pt-ph` / `.pt-cm` / `.pt-nr-hint` | セル内テキスト / プレースホルダー / 中間材マーク / 新規ヒント |
| `.pt-inp` | 編集中 input/select（2px Primary ボーダー） |
| `.pt-ab` | アクションボタン |

---

### 部品カテゴリ

- `partCats` は `as_part_cats`（LocalStorage）に保存されたマスタリストを使用
- 初期値: `["金具","チェーン","ビーズ","梱包材"]`
- 既存部品に含まれるカテゴリはマスタになくても useMemo で補完される
- 管理設定モーダル（`modal="mgmt"` → `mgmtTab="category_setting"`）から追加・削除可能

### 作品カテゴリ

- `productCats` は `as_product_cats`（LocalStorage）に保存されたマスタリストを使用
- 初期値: `["ピアス","イヤリング","ネックレス","ブレスレット","リング","その他"]`
- 既存作品に含まれるカテゴリはマスタになくても useMemo で補完される
- 管理設定モーダル（`modal="mgmt"` → `mgmtTab="category_setting"`）から追加・削除可能
- レシピ登録モーダルでチップ選択（トグル：再タップで解除）または「＋ 新規」で自由入力
- 作品在庫・レシピ一覧はカテゴリフィルタチップでフィルタ、カテゴリ名でアルファベットソート

### 作品を制作フォーム（`modal="made"`）

- `mf.checkedParts`：レシピ部品のチェック状態（`{[partId]: boolean}`）
- **商品選択時に全レシピ素材を自動チェック済み**（`true`）にセット
  ```js
  const prod = products.find(p=>p.id===+e.target.value);
  const checkedParts = prod ? Object.fromEntries(prod.ingredients.map(ing=>[ing.partId,true])) : {};
  ```
- ユーザーは「使わなかった素材」だけタップして解除する操作に変更
- チェック済み素材のみ在庫から差し引き（`type:"recipe"` の部品使用記録を生成）

### 委託終了フロー

1. 委託先詳細の現在庫カードに「委託終了」ボタン（赤枠）を表示（在庫 > 0 のみ）
2. タップすると `modal="consign_end"` が開く
3. 「返品」「廃棄ロス」を選択（デフォルト: 返品）、日付・数量（現在在庫で自動入力）・メモを入力
4. 記録すると `type:"return"` または `type:"loss"` の委託記録が追加され、委託在庫が減算
5. 在庫が 0 になると作品在庫タブの委託先表示・委託先一覧から消える（`stock > 0` フィルタ）

### UIパターン

- カードをタップ → 詳細展開（`open` state で管理、キー: `ps{id}` `rc{id}` `s{id}` `cn{id}`）
- 展開エリア内に編集ボタンを配置（仕入・廃棄・売上・レシピ）
- モーダルはボトムシート形式（28px角丸・ドラッグハンドル付き）
- FAB（右下固定ボタン）でデータ追加（`bottom: 82px`）
- 在庫ステータス: `low`（要発注）/ `warn`（少なめ）/ `ok`（良好）をカード左4pxボーダー色で表現
- 削除ボタンは `.btn-d` クラス（Error色）、編集モーダルの下部に配置
- チップボタン: `.chip` / `.chip.on` クラス（オン時は Secondary Container）
- ヘッダー右端の管理設定ボタン: `.h-mgmt-btn` クラス（半透明白枠・Primary背景上）
- Drive 同期ボタン（管理設定の左隣）: `.h-drive-signin` / `.h-drive-wrap` クラス

### 部品在庫タブのモーダル一覧

| modal値 | 用途 |
|---------|------|
| `parts_add` | FABで開く。「仕入」「マスター」2タブ切替。仕入記録登録と部品マスタ登録を兼ねる |
| `parts_history` | タイトル右「履歴参照」ボタンで開く。「仕入記録」「廃棄記録」2タブ切替の一覧表示 |
| `purchase` | 仕入記録の新規/編集（カード内「仕入」ボタンや履歴から編集） |
| `disposal` | 廃棄記録の新規/編集（カード内「廃棄」ボタンや履歴から編集） |

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
// type:"material" → 母材
// type:"part"     → 中間材（parentId に親の母材IDを設定可能）
// type:undefined  → 通常の部品

// 部品テーブルビューの編集可能列（この順序でTab移動する）
TABLE_EDIT_COLS = ["cat","name","variant","unit","hinban","minStock","location"]

// 部品の最低在庫数（初期10件分のフォールバック用ハードコード）
MIN_STOCK = { 1:50, 2:50, 3:100, 4:30, 5:5, 6:10, 7:80, 8:20, 9:100, 10:50 }

// 全体設定（as_global_settings に保存。管理設定→全体設定で変更）
INIT_GLOBAL_SETTINGS = { avgPriceTax: "excl" }
// avgPriceTax: "excl"（税抜き・デフォルト）| "incl"（税込み）
```

---

## Google Drive 同期

### 概要

LocalStorage をキャッシュとして使いつつ、Google Drive の単一 JSON ファイル（`atelier-stock-data.json`）に全データを同期する。

### 動作フロー

| タイミング | 処理 |
|-----------|------|
| 起動時（トークンキャッシュあり） | `as_drive_token` から直接復元、Drive 同期を開始（ダイアログなし） |
| 起動時（キャッシュ切れ・自動サインインフラグあり） | `prompt:''` で Google セッション Cookie を使い無音再接続、失敗時は `idle` に戻る |
| 起動時（初回 or サインアウト後） | 「同期」ボタン表示のみ（手動サインイン） |
| サインイン直後 | Drive と Local の `lastSavedAt` を比較 → 新しい方を正として古い方を上書き |
| データ変更時 | 2 秒デバウンス後に Drive へ自動書き込み |
| サインアウト時 | ローカルデータはそのまま、Drive 接続・トークンキャッシュ・自動サインインフラグをすべて削除 |

### 実装の注意点

- `driveRef`（useRef）に token・fileId・timer 等の mutable な Drive 状態を集約
- `applyDriveData` 実行時は `driveRef.current.skipSync = true` を立てて自動保存の無限ループを防止
- トークンキャッシュは `sessionStorage` ではなく **`localStorage`** に保存する

---

## データ管理（Export / Import）

| 機能 | 形式 | 内容 |
|------|------|------|
| JSONエクスポート | `.json` | 全テーブル一括。`version` + `exportedAt` + `data` 構造 |
| JSONインポート | `.json` | 全テーブル上書き（確認ダイアログあり） |
| CSVエクスポート | `.csv` | テーブル単位。UTF-8 BOM付き（Excel対応） |
| CSVインポート | `.csv` | マージ（ID重複時上書き）または全置換を選択 |

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
- 月次レポートの期間切り替え（ダッシュボードは現在月固定）
- 制作記録の編集・削除（現状は追加のみ）

### インフラ面
- Google Drive トークン自動リフレッシュ：アクセストークンは 1 時間で失効

---

## 変更履歴（主要）

| 日付 | 内容 |
|------|------|
| 2026-05-22 | 部品在庫タブにテーブルビュー追加。インライン編集・Tab/Shift+Tab移動・最終行からの新規部品追加に対応。`partView` state でカード/テーブルを切り替え。`tableRows` useMemo をカード/テーブル共用に抽出 |
| 2026-05-11 | 全体設定（`as_global_settings`）追加。加重平均単価の税込み/税抜き切替を管理設定→全体設定ページから操作可能に。表示・原価計算・純利益計算すべてに反映 |
| 2026-05-11 | 受注売上（`saleType:"order"`）に部品選択機能追加。選択した部品を在庫から差し引き、部品原価を純利益計算に反映。`partUsages` に `saleId` フィールドと `type:"order"` を追加 |
| 2026-05-11 | Google Drive ヘッダー表示変更：プロフィール写真・名前アバターを廃止し、ステータスドット＋テキストに変更 |
| 2026-05-08 | Google Drive セッション永続化：トークンキャッシュを sessionStorage→localStorage に変更 |
| 2026-04-15 | Google Drive 同期機能実装 |
| 2026-04-14 | デザイン全面刷新：Material Design 3（テラコッタシード）を採用 |