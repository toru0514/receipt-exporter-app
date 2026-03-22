# Receipt Exporter App

Amazon.co.jp の注文確認メールを自動取得・AI解析し、Google スプレッドシートへエクスポートする経費管理アプリケーションです。

## 主な機能

- **Gmail 連携**: Google OAuth でログイン後、Amazon 注文確認メールを自動検索・取得
- **AI 解析**: Google Gemini API を使用してメール本文から注文情報（日付・注文番号・商品名・金額・消費税）を抽出
- **スプレッドシート出力**: 解析結果を Google Sheets へワンクリックでエクスポート
- **一括処理**: 複数メールの同時解析に対応（バッチ処理）
- **日付・キーワードフィルタ**: 期間指定や商品名での絞り込み検索
- **データ検証・編集**: 抽出データのバリデーションとエクスポート前の手動修正
- **キャッシュ**: 解析済みメールの結果をキャッシュし再解析を防止
- **セキュリティ**: CSP ヘッダー、レート制限、入力バリデーション

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | TypeScript (strict mode) |
| UI | React 19, Tailwind CSS 4 |
| 認証 | NextAuth.js v5 (Google OAuth) |
| AI | Google Gemini 2.0 Flash |
| API | Gmail API, Google Sheets API |
| テスト | Vitest, Testing Library |
| Lint | ESLint 9 |
| CI/CD | GitHub Actions |

## セットアップ

### 前提条件

- Node.js 20 以上
- Google Cloud Console プロジェクト（OAuth クライアント ID 発行済み）
- Gmail API, Sheets API, Generative Language API が有効化済み

### インストール

```bash
git clone <repository-url>
cd receipt-exporter-app
npm ci
```

### 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成し、各値を設定してください。

```bash
cp .env.local.example .env.local
```

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth クライアント ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth クライアントシークレット |
| `NEXTAUTH_URL` | Yes | アプリの URL（開発時: `http://localhost:3000`） |
| `NEXTAUTH_SECRET` | Yes | NextAuth セッション暗号化キー（`openssl rand -base64 32` で生成） |
| `GOOGLE_GEMINI_API_KEY` | No | Gemini API キー（未設定時は OAuth トークンを使用） |
| `CRON_SECRET` | No | 定期実行 API の認証トークン |

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# プロダクションサーバー起動
npm start

# テスト実行
npm test

# カバレッジ付きテスト
npm run test:coverage

# Lint
npm run lint
```

## プロジェクト構造

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts    # メール解析 API（単体・バッチ）
│   │   ├── auth/[...nextauth]/ # 認証エンドポイント
│   │   ├── cron/route.ts       # 定期実行エンドポイント
│   │   ├── gmail/route.ts      # Gmail メール取得 API
│   │   ├── health/route.ts     # ヘルスチェック API
│   │   └── sheets/route.ts     # スプレッドシート出力 API
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── DateRangeFilter.tsx     # 日付範囲フィルタ
│   ├── EditableOrderTable.tsx  # 編集可能な注文テーブル
│   ├── EmailList.tsx           # メール一覧
│   ├── Header.tsx              # ヘッダー
│   ├── OrderTable.tsx          # 注文テーブル
│   ├── SearchFilter.tsx        # 検索フィルタ
│   ├── SessionProvider.tsx     # 認証セッション
│   └── SkeletonLoader.tsx      # ローディング UI
├── lib/
│   ├── auth.ts                 # NextAuth 設定
│   ├── cache.ts                # TTL キャッシュ
│   ├── data-validator.ts       # データ検証
│   ├── error-tracker.ts        # エラートラッキング
│   ├── errors.ts               # エラー定義
│   ├── gemini.ts               # Gemini API クライアント
│   ├── gmail.ts                # Gmail API クライアント
│   ├── logger.ts               # 構造化ログ
│   ├── metrics.ts              # メトリクス収集
│   ├── rate-limit.ts           # レート制限
│   ├── retry.ts                # リトライロジック
│   ├── scheduled-job.ts        # 定期実行ジョブ
│   ├── sheets.ts               # Sheets API クライアント
│   ├── tax-calculator.ts       # 消費税計算
│   ├── types.ts                # 型定義
│   └── validation.ts           # 入力バリデーション
├── middleware.ts
└── types/
    └── next-auth.d.ts          # NextAuth 型拡張
```

## Docker

```bash
# Docker Compose で開発環境を起動
docker compose up

# イメージのみビルド
docker build -t receipt-exporter-app .
```

## ライセンス

MIT
