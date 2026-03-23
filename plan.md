# 領収書写真解析機能 実装計画

## 概要
領収書の写真を撮影/選択 → microCMSに保存 → Geminiで解析 → 月別集計・一括ダウンロード

## 環境変数（追加）
```
MICROCMS_API_KEY=...           # microCMS APIキー
MICROCMS_SERVICE_DOMAIN=...    # microCMSサービスドメイン
```

## microCMS スキーマ設計
**API名: receipts**
- image: 画像（メディア）
- date: 日付（テキスト / YYYY-MM-DD）
- storeName: 店舗名（テキスト）
- totalAmount: 合計金額（数値）
- tax: 税額（数値）
- items: 品目一覧（テキストエリア / JSON）
- paymentMethod: 支払方法（テキスト）
- category: カテゴリ（テキスト）
- memo: メモ（テキストエリア）
- analyzedAt: 解析日時（テキスト）

## 実装ステップ

### Step 1: microCMS連携ライブラリ
- `src/lib/microcms.ts` — microCMS APIクライアント（画像アップロード、レシートCRUD、一覧取得）
- `microcms-js-sdk` パッケージのインストール

### Step 2: Gemini画像解析の拡張
- `src/lib/gemini-receipt.ts` — 画像からレシート情報を抽出する関数
- 抽出項目: 日付、店舗名、合計金額、税額、品目一覧、支払方法、カテゴリ

### Step 3: APIルート
- `src/app/api/receipts/route.ts` — GET(一覧取得)、POST(画像アップロード+解析+保存)
- `src/app/api/receipts/download/route.ts` — GET(月別/年別一括ダウンロード ZIP)

### Step 4: 型定義
- `src/lib/receipt-types.ts` — Receipt, ReceiptItem, MonthlyAggregation等

### Step 5: UIコンポーネント
- `src/components/receipt/ReceiptCapture.tsx` — カメラ撮影 + ファイル選択
- `src/components/receipt/ReceiptTable.tsx` — 領収書一覧テーブル（月別フィルタ付き）
- `src/components/receipt/MonthlyAggregation.tsx` — 月別集計表示（合計金額、件数）
- `src/components/receipt/ReceiptDetail.tsx` — 領収書詳細表示（品目一覧含む）
- `src/components/receipt/BulkDownloadButton.tsx` — 月別/年別一括ダウンロードボタン

### Step 6: ページ
- `src/app/receipts/page.tsx` — 領収書写真解析ページ

### Step 7: ナビゲーション
- ヘッダーにページ遷移リンクを追加

## 画面構成（/receipts）
1. **ヘッダー**: カメラ撮影ボタン + ファイル選択ボタン
2. **年月選択**: 年・月のセレクター
3. **月別集計サマリー**: 合計金額、件数
4. **領収書一覧テーブル**: 日付、店舗名、金額、カテゴリ、支払方法
5. **一括ダウンロード**: 月別/年別ダウンロードボタン（ZIP形式）

## パッケージ追加
- `microcms-js-sdk` — microCMS公式SDK
- `jszip` — ZIP生成（一括ダウンロード用）
