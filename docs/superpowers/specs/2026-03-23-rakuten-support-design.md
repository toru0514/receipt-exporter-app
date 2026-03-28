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
├── rakuten.ts         # 楽天 プロバイダー（新規）
└── index.ts           # プロバイダーレジストリ
```

共通ユーティリティ（`extractBody`, `runWithConcurrency`）は `src/lib/gmail.ts` に残し、各プロバイダーから利用する。

### プロバイダーインターフェース (`src/lib/providers/types.ts`)

```typescript
import { OrderEmail, EmailSource, GmailDateFilter } from "../types";

export interface GetEmailsOptions {
  maxResults?: number;
  pageToken?: string;
  dateFilter?: GmailDateFilter;
  /** Amazon専用: リージョン選択 */
  region?: string;
}

export interface GetEmailsResult {
  emails: OrderEmail[];
  nextPageToken?: string;
}

export interface EmailProvider {
  source: EmailSource;
  buildQuery(options: GetEmailsOptions): string;
  getEmails(accessToken: string, options: GetEmailsOptions): Promise<GetEmailsResult>;
  /** 領収書URLが不明な場合のデフォルトURL生成 */
  getDefaultReceiptUrl(orderNumber: string): string;
}
```

### プロバイダーレジストリ (`src/lib/providers/index.ts`)

```typescript
import { EmailSource } from "../types";
import { EmailProvider } from "./types";
import { AmazonProvider } from "./amazon";
import { RakutenProvider } from "./rakuten";

const providers = new Map<EmailSource, EmailProvider>([
  ["amazon", new AmazonProvider()],
  ["rakuten", new RakutenProvider()],
]);

export function getProvider(source: EmailSource): EmailProvider {
  const provider = providers.get(source);
  if (!provider) throw new Error(`Unknown provider: ${source}`);
  return provider;
}
```

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

// AnalysisResult は AmazonEmail エイリアス経由で自動的に OrderEmail 互換となる
// source は email.source および order.source から取得可能
export interface AnalysisResult {
  email: AmazonEmail;  // = OrderEmail
  order: ParsedOrder | null;
  error?: string;
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

### 領収書URLのデフォルト

楽天市場の領収書URLがメール内にない場合: `https://order.my.rakuten.co.jp/`（購入履歴ページ）

## Gemini 解析の変更

### `src/lib/gemini.ts`

- `analyzeEmailWithGemini(emailHtml, apiKey, source)` に `source` パラメータ追加
- `analyzeEmailsBatch(emails, apiKey, source)` にも `source` パラメータ追加（バッチ解析対応）
- プロバイダーごとにプロンプトを切り替え:
  - **Amazon用**: 現行の `EXTRACTION_PROMPT`（変更なし）
  - **楽天用**: `RAKUTEN_EXTRACTION_PROMPT` を新規作成
    - 楽天の注文番号パターン対応
    - 税込価格の扱い（楽天は商品価格が税込表示）
    - ショップ名の抽出は不要（ParsedOrderの型に含まれないため）
- `source` フィールドの設定: API route 側で `analyzeEmailWithGemini` の戻り値に対して設定する（Gemini解析レイヤーはソース非依存に保つ）

### 楽天用プロンプトのポイント

- 注文番号: `注文番号 XXXXX-XXXXXXXX-XXXXXXXXXX` パターン
- 金額: `X,XXX円 x N個 = X,XXX円` パターン（※10%税込の注記あり）
- 合計: `支払い金額   X,XXX（円）` パターン
- 消費税: 楽天メールには消費税額が明示されていないため、合計金額から10%内税として概算を指示。食品等の軽減税率(8%)は区別しない。算出不能な場合は `tax: 0` を返す。

## API 変更

### `/api/gmail` (GET)

- `provider` クエリパラメータ追加（`amazon` | `rakuten`、デフォルト: `amazon`）
- `region` パラメータは `provider=amazon` の場合のみ有効
- プロバイダーレジストリから `EmailProvider` を取得してメール取得

### `/api/analyze` (POST/PATCH)

- POST: リクエストボディに `source` フィールド追加（`amazon` | `rakuten`、デフォルト: `amazon`）
- PATCH（バッチ）: 同様に `source` フィールド追加。バッチ内の全メールは同一ソースとする。
- `source` に応じてGeminiプロンプトを切り替え
- 解析結果に `source` フィールドをセット（API route 側で付与）
- キャッシュキー: `${source}:${emailId}` 形式にしてソース間の衝突を防止

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

### EmailList (`src/components/EmailList.tsx`)

- 空状態のメッセージをプロバイダーに応じて切り替え:
  - Amazon: 「Amazonからの注文確認メールが見つかりませんでした」
  - 楽天: 「楽天市場からの注文確認メールが見つかりませんでした」
- `provider` prop を追加

### SortableTable (`src/components/SortableTable.tsx`)

- `FlatRow` に `source: EmailSource` フィールド追加
- テーブルに「ソース」列を追加（「Amazon」「楽天」表示）
- 領収書URLのデフォルト: `getProvider(source).getDefaultReceiptUrl(orderNumber)` を利用

## エクスポート変更

### Google Sheets (`src/lib/sheets.ts`)

- ヘッダー: 6列→7列（`注文日, 注文番号, 商品名, 金額, 消費税, ソース, 領収書リンク`）
- レンジ参照: `A1:F1` → `A1:G1`、`A:F` → `A:G` に更新
- `source` 列に「Amazon」「楽天」を出力
- 領収書リンクのデフォルト: `getProvider(source).getDefaultReceiptUrl(orderNumber)` を利用
- スプレッドシートタイトル: `Amazon経費管理_` → `EC経費管理_`
- 既存スプレッドシートのマイグレーション: ヘッダー行チェック時に6列の旧フォーマットを検出した場合、7列ヘッダーで上書き更新する

### CSV エクスポート (`src/lib/csv-export.ts`)

- ヘッダーに「ソース」列を追加
- 各行に `source` を出力（「Amazon」「楽天」）
- 領収書リンクのデフォルト: `getProvider(source).getDefaultReceiptUrl(orderNumber)` を利用
- デフォルトファイル名: `amazon_orders_` → `ec_orders_` に変更

## 変更対象ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `src/lib/types.ts` | `EmailSource` 型追加、`OrderEmail` 汎用化、`ParsedOrder` に `source` 追加 |
| `src/lib/providers/types.ts` | `EmailProvider` インターフェース定義（新規） |
| `src/lib/providers/amazon.ts` | Amazon プロバイダー実装（新規、gmail.tsから移行） |
| `src/lib/providers/rakuten.ts` | 楽天プロバイダー実装（新規） |
| `src/lib/providers/index.ts` | プロバイダーレジストリ（新規） |
| `src/lib/gmail.ts` | 共通ユーティリティのみ残す（`extractBody`, `runWithConcurrency`） |
| `src/lib/gemini.ts` | `source` パラメータ追加、楽天用プロンプト追加 |
| `src/app/api/gmail/route.ts` | `provider` パラメータ対応 |
| `src/app/api/analyze/route.ts` | `source` パラメータ対応（POST・PATCH両方）、キャッシュキー更新 |
| `src/app/page.tsx` | タブUI追加、provider ステート管理 |
| `src/components/EmailList.tsx` | プロバイダー対応の空状態メッセージ |
| `src/components/SortableTable.tsx` | ソース列追加 |
| `src/components/CsvDownloadButton.tsx` | ソース列追加（csv-export.ts経由） |
| `src/lib/csv-export.ts` | ソース列追加、デフォルトファイル名変更 |
| `src/lib/sheets.ts` | 7列化、ソース列追加、レンジ更新、タイトル変更、旧フォーマット検出・更新 |

## 命名規則の補足

- API のクエリパラメータ名: `provider`（メール取得時のプロバイダー選択）
- API のボディフィールド名: `source`（解析時のメールソース識別）
- 両者は同じ `EmailSource` 型の値を取る。名前を分けている理由: `provider` はメール取得の「どこから取るか」、`source` はデータの「どこ由来か」を表すため。
