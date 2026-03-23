# 楽天市場対応 設計書

## 概要

現在Amazonのみに対応しているEC経費管理アプリに、楽天市場の注文確認メール解析機能を追加する。プロバイダー抽象化パターンを採用し、将来的な他ECサイト対応も見据えた拡張性のある設計とする。

## 要件

- 楽天市場の注文確認メール（`order@rakuten.co.jp`）をGmail APIで取得
- Gemini AIで楽天メールのHTML解析→注文データ抽出
- UIはタブ切り替え方式（Amazon / 楽天）
- Google Sheets / CSVエクスポートは同一シートにソース列を追加して混在表示

## アーキテクチャ

### プロバイダー抽象化

```
src/lib/providers/
├── types.ts           # EmailProvider インターフェース定義
├── amazon.ts          # Amazon プロバイダー（既存gmail.tsから移行）
└── rakuten.ts         # 楽天 プロバイダー（新規）
```

`EmailProvider` インターフェース:
- `source: EmailSource` — プロバイダー識別子
- `buildQuery(dateFilter)` — Gmail検索クエリ生成
- `getEmails(accessToken, options)` — Gmail APIでメール取得・パース

共通ユーティリティ（`extractBody`, `runWithConcurrency`）は `src/lib/gmail.ts` に残し、各プロバイダーから利用する。

## 型定義の変更

### `src/lib/types.ts`

```typescript
export type EmailSource = "amazon" | "rakuten";

// AmazonEmail を汎用化
export interface OrderEmail {
  id: string;
  threadId: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  source: EmailSource;
}

// 後方互換エイリアス
export type AmazonEmail = OrderEmail;

export interface ParsedOrder {
  orderDate: string;
  orderNumber: string;
  items: OrderItem[];
  totalAmount: number;
  tax: number;
  receiptUrl: string;
  source: EmailSource;  // 追加
}
```

## 楽天メール取得

### 検索条件

| 項目 | 値 |
|------|-----|
| 送信元 | `order@rakuten.co.jp` |
| 件名パターン | `【楽天市場】注文内容ご確認` |
| 転送メール | `subject:fwd 楽天市場 注文内容ご確認` |

### 楽天メールの注文データ構造

実際のメールサンプルから確認した構造:
- 注文番号: `393703-20260110-0005400563`（ショップID-日付-連番）
- 注文日時: `2026-01-10 13:49:49`
- 商品: 商品名、単価 x 数量 = 小計（税込）
- 支払い金額: 合計金額
- ショップ名: メール内に記載あり

## Gemini 解析の変更

### `src/lib/gemini.ts`

- `analyzeEmailWithGemini(emailHtml, apiKey, source)` に `source` パラメータ追加
- プロバイダーごとにプロンプトを切り替え:
  - **Amazon用**: 現行の `EXTRACTION_PROMPT`（変更なし）
  - **楽天用**: `RAKUTEN_EXTRACTION_PROMPT` を新規作成
    - 楽天の注文番号パターン対応
    - 税込価格の扱い（楽天は商品価格が税込表示）
    - ショップ名の抽出は不要（ParsedOrderの型に含まれないため）
- `toParsedOrder()` で `source` フィールドをセット

### 楽天用プロンプトのポイント

- 注文番号: `注文番号 XXXXX-XXXXXXXX-XXXXXXXXXX` パターン
- 金額: `X,XXX円 x N個 = X,XXX円` パターン（※10%税込の注記あり）
- 合計: `支払い金額   X,XXX（円）` パターン
- 消費税は明示されていないため、合計金額から内税として計算を指示

## API 変更

### `/api/gmail` (GET)

- `provider` クエリパラメータ追加（`amazon` | `rakuten`、デフォルト: `amazon`）
- `region` パラメータは `provider=amazon` の場合のみ有効
- プロバイダーに応じて適切な `EmailProvider` を選択してメール取得

### `/api/analyze` (POST/PATCH)

- リクエストボディに `source` フィールド追加（`amazon` | `rakuten`、デフォルト: `amazon`）
- `source` に応じてGeminiプロンプトを切り替え

## UI 変更

### メインページ (`src/app/page.tsx`)

- ページ上部に **Amazon / 楽天** タブUIを追加
- `provider` ステート（`"amazon" | "rakuten"`）でタブ状態を管理
- タブ切り替え時:
  - メール一覧・解析結果をリセット
  - Amazon: リージョン選択を表示
  - 楽天: リージョン選択を非表示
- メール取得APIに `provider` パラメータを付与
- 解析APIに `source` パラメータを付与
- ログイン前画面タイトル: 「Amazon 経費管理」→「EC経費管理」

### SortableTable (`src/components/SortableTable.tsx`)

- `FlatRow` に `source: EmailSource` フィールド追加
- テーブルに「ソース」列を追加（「Amazon」「楽天」表示）
- 楽天の場合、領収書URLのデフォルトは `https://order.my.rakuten.co.jp/`

### CsvDownloadButton (`src/components/CsvDownloadButton.tsx`)

- CSV出力に「ソース」列を追加

## エクスポート変更

### Google Sheets (`src/lib/sheets.ts`)

- ヘッダー: 6列→7列（`注文日, 注文番号, 商品名, 金額, 消費税, ソース, 領収書リンク`）
- `source` 列に「Amazon」「楽天」を出力
- 楽天の場合、領収書リンクのデフォルトは `https://order.my.rakuten.co.jp/`
- スプレッドシートタイトル: `Amazon経費管理_` → `EC経費管理_`

## 変更対象ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `src/lib/types.ts` | `EmailSource` 型追加、`OrderEmail` 汎用化、`ParsedOrder` に `source` 追加 |
| `src/lib/providers/types.ts` | `EmailProvider` インターフェース定義（新規） |
| `src/lib/providers/amazon.ts` | Amazon プロバイダー実装（新規、gmail.tsから移行） |
| `src/lib/providers/rakuten.ts` | 楽天プロバイダー実装（新規） |
| `src/lib/gmail.ts` | 共通ユーティリティのみ残す（`extractBody`, `runWithConcurrency`） |
| `src/lib/gemini.ts` | `source` パラメータ追加、楽天用プロンプト追加 |
| `src/app/api/gmail/route.ts` | `provider` パラメータ対応 |
| `src/app/api/analyze/route.ts` | `source` パラメータ対応 |
| `src/app/page.tsx` | タブUI追加、provider ステート管理 |
| `src/components/SortableTable.tsx` | ソース列追加 |
| `src/components/CsvDownloadButton.tsx` | ソース列追加 |
| `src/lib/sheets.ts` | 7列化、ソース列追加、タイトル変更 |
