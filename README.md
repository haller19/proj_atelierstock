# Atelier Stock

個人ハンドメイド販売者向けの部品・作品在庫管理 PWA。

---

## 機能

- **HOME（ダッシュボード）** — 今月の売上・純利益・利益率・在庫アラートをひと目で確認。KPI カードやチャネル別棒グラフをタップすると売上タブへ遷移
- **部品在庫** — 部品マスタの登録・編集、加重平均単価・仕入先・在庫ステータス表示。母材→中間材の親子管理（品番連番・残量バー・インデント表示）
- **素材加工** — 母材から中間材を切り出す加工記録。分数・%入力対応のショートカットチップ付き
- **作品** — レシピ登録・原価計算（材料費・梱包費・送料・人件費）・制作記録・手元在庫。カテゴリフィルタ・ソート
- **委託管理** — 委託先ごとの納品・売上・返品・廃棄ロス記録。委託売上は売上タブに自動連動
- **売上** — 年度・チャネルフィルタ、チャネル別手数料・純利益計算
- **データ管理** — JSON/CSV エクスポート・インポート（管理設定から操作）
- **Google Drive 同期** — ユーザーごとの Google Drive にデータを保存。複数端末で自動同期

---

## セットアップ

### 必要なもの

- Node.js 18+
- FontAwesome Pro 5.15（`public/fontawesome/` に配置）

### インストール

```bash
npm install
```

### 環境変数（Google Drive 同期を使う場合）

```bash
cp .env.example .env.local
# .env.local を編集して VITE_DRIVE_CLIENT_ID を設定
```

**Google Cloud Console 設定手順:**

1. [console.cloud.google.com](https://console.cloud.google.com/) でプロジェクト作成
2. Google Drive API を有効化
3. 「認証情報」→「OAuth 2.0 クライアントID」を作成（種類: ウェブアプリケーション）
4. 承認済みの JavaScript 生成元に開発URL・本番URLを追加
5. OAuth 同意画面 → スコープ `drive.file` を追加 → テストユーザーを登録
6. 取得したクライアントIDを `.env.local` の `VITE_DRIVE_CLIENT_ID` に設定

> **注意:** クライアントシークレット（CLIENT_SECRET）はフロントエンドに置かないでください。`drive.file` スコープの OAuth フローはシークレット不要です。

`VITE_DRIVE_CLIENT_ID` が未設定の場合、Drive 同期 UI は表示されず LocalStorage のみで動作します。

---

## 開発コマンド

```bash
npm run dev      # 開発サーバ起動（http://localhost:5173）
npm run build    # 本番ビルド → dist/ に出力
npm run preview  # ビルド結果をローカルで確認
```

---

## Google Drive 同期の仕組み

```
LocalStorage（キャッシュ）
    ↕ 起動時：新しい方を正として上書き（タイムスタンプ比較）
Google Drive（atelier-stock-data.json）
    ↑ データ変更から 2 秒後に自動保存
```

- **ユーザー分離**: 各ユーザーが自分の Google アカウントでサインインし、自分の Drive にデータを保存。同じアプリURLを使っても別々のデータになる
- **オフライン対応**: 未サインイン時も LocalStorage で通常通り動作

---

## デプロイ（Xserver）

1. `npm run build` を実行
2. `dist/` の中身をすべて FTP で `public_html/` 以下にアップロード
3. サブディレクトリに置く場合は `vite.config.js` に `base: '/サブディレクトリ名/'` を追加してから再ビルド

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | React 18（Vite） |
| スタイル | CSS-in-JS（テンプレートリテラル） |
| 状態管理 | useState / useMemo / useRef（外部ライブラリなし） |
| 永続化 | LocalStorage + Google Drive（オプション） |
| デザイン | Material Design 3（テラコッタシード） |
| フォント | DM Serif Display / Zen Kaku Gothic New（Google Fonts） |
| アイコン | FontAwesome Pro 5.15 |
