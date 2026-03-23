# 楽天市場対応 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Amazon専用のEC経費管理アプリに楽天市場の注文メール解析機能を追加する

**Architecture:** プロバイダー抽象化パターンで Amazon/楽天を切り替え可能にする。共通の EmailProvider インターフェースを定義し、各プロバイダーが Gmail 検索クエリ生成・メール取得・デフォルト領収書URL生成を実装する。メール取得の共通処理（Gmail API呼び出し、メールパース）は `gmail.ts` の `fetchAndParseEmails` ヘルパーに集約する。

**Tech Stack:** Next.js 16, TypeScript, Vitest, Google Gemini 2.5 Flash, Gmail API, Google Sheets API

**Spec:** `docs/superpowers/specs/2026-03-23-rakuten-support-design.md`

---

## File Structure

### New files
- `src/lib/providers/types.ts` — EmailProvider インターフェース定義
- `src/lib/providers/amazon.ts` — Amazon プロバイダー実装
- `src/lib/providers/rakuten.ts` — 楽天プロバイダー実装
- `src/lib/providers/index.ts` — プロバイダーレジストリ
- `src/lib/__tests__/providers.test.ts` — プロバイダーのテスト
- `src/lib/__tests__/csv-export.test.ts` — CSV エクスポートのテスト

### Modified files
- `src/lib/types.ts` — EmailSource 型追加、OrderEmail 汎用化、ParsedOrder に source 追加
- `src/lib/gmail.ts` — 共通ユーティリティに縮小 + `fetchAndParseEmails` ヘルパー追加。旧 `getAmazonEmails` は互換シムとして残す（Task 9 で削除）
- `src/lib/gemini.ts` — source パラメータ追加、楽天用プロンプト追加、`toParsedOrder` に source 追加
- `src/lib/sheets.ts` — 7列化、ソース列追加、マイグレーション対応
- `src/lib/csv-export.ts` — ソース列追加、ファイル名変更
- `src/app/api/gmail/route.ts` — provider パラメータ対応、`getAmazonEmails` 互換シム削除
- `src/app/api/analyze/route.ts` — source パラメータ対応（POST・PATCH両方）、キャッシュキー更新
- `src/app/page.tsx` — タブUI、provider ステート
- `src/components/EmailList.tsx` — プロバイダー対応の空状態メッセージ
- `src/components/SortableTable.tsx` — ソース列追加
- `src/components/CsvDownloadButton.tsx` — コード変更不要（csv-export.ts 経由で自動対応）
- `src/lib/__tests__/gmail.test.ts` — リファクタ後のテスト更新
- `src/lib/__tests__/gemini.test.ts` — source パラメータ対応
- `src/lib/__tests__/sheets.test.ts` — 7列化対応

---

### Task 1: 型定義の更新

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: types.ts を更新**

`src/lib/types.ts` を以下のように変更する:

```typescript
export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export type EmailSource = "amazon" | "rakuten";

export interface OrderEmail {
  id: string;
  threadId: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  source: EmailSource;
}

/** 後方互換エイリアス */
export type AmazonEmail = OrderEmail;

export interface ParsedOrder {
  orderDate: string;
  orderNumber: string;
  items: OrderItem[];
  totalAmount: number;
  tax: number;
  receiptUrl: string;
  source: EmailSource;
}

export interface AnalysisResult {
  email: AmazonEmail;
  order: ParsedOrder | null;
  error?: string;
}
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/types.ts
git commit -m "refactor: EmailSource型を追加し、OrderEmail/ParsedOrderにsourceフィールドを追加"
```

注: この時点で下流ファイルに型エラーが発生するが、後続タスクで順次修正する。

---

### Task 2: プロバイダーインターフェースとレジストリ

**Files:**
- Create: `src/lib/providers/types.ts`
- Create: `src/lib/providers/index.ts`

- [ ] **Step 1: プロバイダーインターフェースを作成**

`src/lib/providers/types.ts`:
```typescript
import { OrderEmail, EmailSource } from "../types";

export interface GmailDateFilter {
  after?: string;
  before?: string;
}

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
  readonly source: EmailSource;
  buildQuery(options: GetEmailsOptions): string;
  getEmails(accessToken: string, options: GetEmailsOptions): Promise<GetEmailsResult>;
  getDefaultReceiptUrl(orderNumber: string): string;
}
```

- [ ] **Step 2: プロバイダーレジストリを作成**

`src/lib/providers/index.ts`:
```typescript
import { EmailSource } from "../types";
import { EmailProvider } from "./types";

const providers = new Map<EmailSource, EmailProvider>();

export function getProvider(source: EmailSource): EmailProvider {
  const provider = providers.get(source);
  if (!provider) {
    throw new Error(`Unknown provider: ${source}`);
  }
  return provider;
}

export function registerProvider(provider: EmailProvider): void {
  providers.set(provider.source, provider);
}

export { EmailProvider, GetEmailsOptions, GetEmailsResult, GmailDateFilter } from "./types";
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/providers/
git commit -m "feat: EmailProviderインターフェースとレジストリを追加"
```

---

### Task 3: gmail.ts を共通ユーティリティに縮小

**Files:**
- Modify: `src/lib/gmail.ts`

- [ ] **Step 1: gmail.ts をリファクタリング**

gmail.ts に共通の `fetchAndParseEmails` ヘルパーを追加し、`extractBody`, `runWithConcurrency`, `createGmailClient` をエクスポートする。

**重要:** 旧 `getAmazonEmails` 関数は互換シムとして残す。これにより `/api/gmail/route.ts` と既存テストが壊れない。Task 9 で互換シムを削除する。

`src/lib/gmail.ts`:

```typescript
import { google } from "googleapis";
import { OrderEmail, EmailSource } from "./types";
import { withRetry } from "./retry";
import { GetEmailsOptions, GetEmailsResult, GmailDateFilter } from "./providers/types";

/** 並列取得の最大同時実行数 */
const MAX_CONCURRENCY = 5;

export const GMAIL_RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  onRetry: (attempt: number, error: unknown, delayMs: number) => {
    console.warn(
      `[Gmail] リトライ ${attempt}/3 (${delayMs}ms後): ${error instanceof Error ? error.message : String(error)}`
    );
  },
};

/**
 * 並列実行数を制御しながら非同期タスクを実行する
 */
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number = MAX_CONCURRENCY
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index++;
      try {
        const value = await tasks[currentIndex]();
        results[currentIndex] = { status: "fulfilled", value };
      } catch (reason) {
        results[currentIndex] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker()
  );
  await Promise.all(workers);

  return results;
}

export function extractBody(payload: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any;
  if (!p) return "";

  if (p.mimeType === "text/html" && p.body?.data) {
    return Buffer.from(p.body.data, "base64").toString("utf-8");
  }

  if (p.parts) {
    for (const part of p.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    for (const part of p.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  if (p.body?.data) {
    return Buffer.from(p.body.data, "base64").toString("utf-8");
  }

  return "";
}

/**
 * Gmail APIクライアントを生成する
 */
export function createGmailClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

/**
 * 共通のメール取得・パース処理。各プロバイダーから呼び出す。
 */
export async function fetchAndParseEmails(
  accessToken: string,
  query: string,
  source: EmailSource,
  options: GetEmailsOptions
): Promise<GetEmailsResult> {
  const gmail = createGmailClient(accessToken);

  const listResponse = await withRetry(
    () =>
      gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: options.maxResults ?? 20,
        pageToken: options.pageToken,
      }),
    GMAIL_RETRY_OPTIONS
  );

  const messages = listResponse.data.messages || [];
  const nextPageToken = listResponse.data.nextPageToken ?? undefined;

  if (messages.length === 0) {
    return { emails: [], nextPageToken };
  }

  const tasks = messages.map((msg) => () =>
    withRetry(
      () =>
        gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "full",
        }),
      GMAIL_RETRY_OPTIONS
    )
  );

  const settled = await runWithConcurrency(tasks);

  const emails: OrderEmail[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "rejected") {
      console.error(`Failed to fetch message ${messages[i].id}:`, result.reason);
      continue;
    }

    const detail = result.value;
    const headers = detail.data.payload?.headers || [];
    const subject =
      headers.find((h) => h.name === "Subject")?.value || "(no subject)";
    const date = headers.find((h) => h.name === "Date")?.value || "";

    const body = extractBody(detail.data.payload);

    emails.push({
      id: messages[i].id!,
      threadId: messages[i].threadId!,
      subject,
      date,
      snippet: detail.data.snippet || "",
      body,
      source,
    });
  }

  return { emails, nextPageToken };
}

// ===== 後方互換シム（Task 9 で削除） =====

export type AmazonRegion = "jp" | "us" | "all";

export { GmailDateFilter };

const AMAZON_SENDERS_JP = [
  "auto-confirm@amazon.co.jp",
  "shipment-tracking@amazon.co.jp",
];

const AMAZON_SENDERS_US = [
  "auto-confirm@amazon.com",
  "shipment-tracking@amazon.com",
];

function getSendersForRegion(region: AmazonRegion): string[] {
  switch (region) {
    case "jp":
      return AMAZON_SENDERS_JP;
    case "us":
      return AMAZON_SENDERS_US;
    case "all":
      return [...AMAZON_SENDERS_JP, ...AMAZON_SENDERS_US];
  }
}

function buildAmazonQuery(
  region: AmazonRegion = "jp",
  dateFilter?: GmailDateFilter
): string {
  const senders = getSendersForRegion(region);
  const fromConditions = senders.map((s) => `from:${s}`).join(" OR ");

  const forwardedCondition =
    region === "us"
      ? "subject:fwd subject:shipped amazon.com"
      : region === "jp"
        ? "subject:fwd subject:発送済み amazon.co.jp"
        : "subject:fwd (subject:発送済み OR subject:shipped) (amazon.co.jp OR amazon.com)";

  let query = `(${fromConditions} OR (${forwardedCondition}))`;

  if (dateFilter?.after) {
    query += ` after:${dateFilter.after.replace(/-/g, "/")}`;
  }
  if (dateFilter?.before) {
    query += ` before:${dateFilter.before.replace(/-/g, "/")}`;
  }

  return query;
}

export interface GetAmazonEmailsResult {
  emails: OrderEmail[];
  nextPageToken?: string;
}

/** @deprecated Use getProvider("amazon").getEmails() instead */
export async function getAmazonEmails(
  accessToken: string,
  maxResults: number = 20,
  pageToken?: string,
  region: AmazonRegion = "jp",
  dateFilter?: GmailDateFilter
): Promise<GetAmazonEmailsResult> {
  const query = buildAmazonQuery(region, dateFilter);
  return fetchAndParseEmails(accessToken, query, "amazon", {
    maxResults,
    pageToken,
    dateFilter,
    region,
  });
}
```

- [ ] **Step 2: 既存テストが通ることを確認**

Run: `npx vitest run src/lib/__tests__/gmail.test.ts`
Expected: PASS — `getAmazonEmails` 互換シムが残っているため既存テストは壊れない

- [ ] **Step 3: コミット**

```bash
git add src/lib/gmail.ts
git commit -m "refactor: gmail.tsに共通fetchAndParseEmailsヘルパーを追加（互換シム残置）"
```

---

### Task 4: Amazon プロバイダー実装

**Files:**
- Create: `src/lib/providers/amazon.ts`
- Modify: `src/lib/providers/index.ts`
- Create: `src/lib/__tests__/providers.test.ts`

- [ ] **Step 1: テストを作成**

`src/lib/__tests__/providers.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock googleapis
const mockMessagesList = vi.fn();
const mockMessagesGet = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class MockOAuth2 {
        setCredentials = vi.fn();
      },
    },
    gmail: vi.fn(() => ({
      users: {
        messages: {
          list: mockMessagesList,
          get: mockMessagesGet,
        },
      },
    })),
  },
}));

vi.mock("../retry", () => ({
  withRetry: <T>(fn: () => Promise<T>) => fn(),
}));

function base64Encode(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64");
}

describe("AmazonProvider", () => {
  let provider: import("../providers/types").EmailProvider;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { AmazonProvider } = await import("../providers/amazon");
    provider = new AmazonProvider();
  });

  it("source が amazon である", () => {
    expect(provider.source).toBe("amazon");
  });

  it("JPリージョンのクエリを構築する", () => {
    const query = provider.buildQuery({ region: "jp" });
    expect(query).toContain("from:auto-confirm@amazon.co.jp");
    expect(query).not.toContain("from:auto-confirm@amazon.com");
  });

  it("USリージョンのクエリを構築する", () => {
    const query = provider.buildQuery({ region: "us" });
    expect(query).toContain("from:auto-confirm@amazon.com");
    expect(query).not.toContain("from:auto-confirm@amazon.co.jp");
  });

  it("allリージョンで両方の送信元を含む", () => {
    const query = provider.buildQuery({ region: "all" });
    expect(query).toContain("from:auto-confirm@amazon.co.jp");
    expect(query).toContain("from:auto-confirm@amazon.com");
  });

  it("日付フィルタを含むクエリを構築する", () => {
    const query = provider.buildQuery({
      dateFilter: { after: "2025-01-01", before: "2025-12-31" },
    });
    expect(query).toContain("after:2025/01/01");
    expect(query).toContain("before:2025/12/31");
  });

  it("メールを取得して source: amazon を付与する", async () => {
    const htmlBody = "<html>注文確認</html>";
    mockMessagesList.mockResolvedValue({
      data: { messages: [{ id: "msg1", threadId: "t1" }] },
    });
    mockMessagesGet.mockResolvedValue({
      data: {
        snippet: "test",
        payload: {
          headers: [
            { name: "Subject", value: "注文確認" },
            { name: "Date", value: "2025-01-15" },
          ],
          mimeType: "text/html",
          body: { data: base64Encode(htmlBody) },
        },
      },
    });

    const result = await provider.getEmails("token", {});
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].source).toBe("amazon");
    expect(result.emails[0].body).toBe(htmlBody);
  });

  it("デフォルト領収書URLを生成する", () => {
    const url = provider.getDefaultReceiptUrl("250-1234567-7654321");
    expect(url).toBe(
      "https://www.amazon.co.jp/gp/css/summary/print.html?orderID=250-1234567-7654321"
    );
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/__tests__/providers.test.ts 2>&1 | tail -5`
Expected: FAIL — AmazonProvider が存在しない

- [ ] **Step 3: Amazon プロバイダーを実装**

`src/lib/providers/amazon.ts`:

```typescript
import { fetchAndParseEmails } from "../gmail";
import { EmailProvider, GetEmailsOptions, GetEmailsResult } from "./types";

const AMAZON_SENDERS_JP = [
  "auto-confirm@amazon.co.jp",
  "shipment-tracking@amazon.co.jp",
];

const AMAZON_SENDERS_US = [
  "auto-confirm@amazon.com",
  "shipment-tracking@amazon.com",
];

export type AmazonRegion = "jp" | "us" | "all";

function getSendersForRegion(region: AmazonRegion): string[] {
  switch (region) {
    case "jp":
      return AMAZON_SENDERS_JP;
    case "us":
      return AMAZON_SENDERS_US;
    case "all":
      return [...AMAZON_SENDERS_JP, ...AMAZON_SENDERS_US];
  }
}

export class AmazonProvider implements EmailProvider {
  readonly source = "amazon" as const;

  buildQuery(options: GetEmailsOptions): string {
    const region = (options.region as AmazonRegion) || "jp";
    const senders = getSendersForRegion(region);
    const fromConditions = senders.map((s) => `from:${s}`).join(" OR ");

    const forwardedCondition =
      region === "us"
        ? "subject:fwd subject:shipped amazon.com"
        : region === "jp"
          ? "subject:fwd subject:発送済み amazon.co.jp"
          : "subject:fwd (subject:発送済み OR subject:shipped) (amazon.co.jp OR amazon.com)";

    let query = `(${fromConditions} OR (${forwardedCondition}))`;

    if (options.dateFilter?.after) {
      query += ` after:${options.dateFilter.after.replace(/-/g, "/")}`;
    }
    if (options.dateFilter?.before) {
      query += ` before:${options.dateFilter.before.replace(/-/g, "/")}`;
    }

    return query;
  }

  async getEmails(accessToken: string, options: GetEmailsOptions): Promise<GetEmailsResult> {
    const query = this.buildQuery(options);
    return fetchAndParseEmails(accessToken, query, this.source, options);
  }

  getDefaultReceiptUrl(orderNumber: string): string {
    return `https://www.amazon.co.jp/gp/css/summary/print.html?orderID=${orderNumber}`;
  }
}
```

- [ ] **Step 4: レジストリに Amazon プロバイダーを登録**

`src/lib/providers/index.ts` を更新:

```typescript
import { EmailSource } from "../types";
import { EmailProvider } from "./types";
import { AmazonProvider } from "./amazon";

const providers = new Map<EmailSource, EmailProvider>();
providers.set("amazon", new AmazonProvider());

export function getProvider(source: EmailSource): EmailProvider {
  const provider = providers.get(source);
  if (!provider) {
    throw new Error(`Unknown provider: ${source}`);
  }
  return provider;
}

export { EmailProvider, GetEmailsOptions, GetEmailsResult, GmailDateFilter } from "./types";
export { AmazonRegion } from "./amazon";
```

- [ ] **Step 5: テストを実行**

Run: `npx vitest run src/lib/__tests__/providers.test.ts`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/providers/ src/lib/__tests__/providers.test.ts
git commit -m "feat: Amazonプロバイダーを実装"
```

---

### Task 5: 楽天プロバイダー実装

**Files:**
- Create: `src/lib/providers/rakuten.ts`
- Modify: `src/lib/providers/index.ts`
- Modify: `src/lib/__tests__/providers.test.ts`

- [ ] **Step 1: テストを追加**

`src/lib/__tests__/providers.test.ts` のファイル末尾（最後の `});` の後）に以下を追加:

```typescript
describe("RakutenProvider", () => {
  let provider: import("../providers/types").EmailProvider;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { RakutenProvider } = await import("../providers/rakuten");
    provider = new RakutenProvider();
  });

  it("source が rakuten である", () => {
    expect(provider.source).toBe("rakuten");
  });

  it("楽天市場のクエリを構築する", () => {
    const query = provider.buildQuery({});
    expect(query).toContain("from:order@rakuten.co.jp");
    expect(query).toContain("楽天市場");
  });

  it("転送メールも検索対象にする", () => {
    const query = provider.buildQuery({});
    expect(query).toContain("subject:fwd");
  });

  it("日付フィルタを含むクエリを構築する", () => {
    const query = provider.buildQuery({
      dateFilter: { after: "2025-01-01", before: "2025-12-31" },
    });
    expect(query).toContain("after:2025/01/01");
    expect(query).toContain("before:2025/12/31");
  });

  it("メールを取得して source: rakuten を付与する", async () => {
    const htmlBody = "<html>楽天市場注文確認</html>";
    mockMessagesList.mockResolvedValue({
      data: { messages: [{ id: "rmsg1", threadId: "rt1" }] },
    });
    mockMessagesGet.mockResolvedValue({
      data: {
        snippet: "楽天",
        payload: {
          headers: [
            { name: "Subject", value: "【楽天市場】注文内容ご確認" },
            { name: "Date", value: "2026-01-10" },
          ],
          mimeType: "text/html",
          body: { data: base64Encode(htmlBody) },
        },
      },
    });

    const result = await provider.getEmails("token", {});
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].source).toBe("rakuten");
    expect(result.emails[0].body).toBe(htmlBody);
  });

  it("デフォルト領収書URLを返す", () => {
    const url = provider.getDefaultReceiptUrl("393703-20260110-0005400563");
    expect(url).toBe("https://order.my.rakuten.co.jp/");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/__tests__/providers.test.ts 2>&1 | tail -5`
Expected: FAIL — RakutenProvider が存在しない

- [ ] **Step 3: 楽天プロバイダーを実装**

`src/lib/providers/rakuten.ts`:

```typescript
import { fetchAndParseEmails } from "../gmail";
import { EmailProvider, GetEmailsOptions, GetEmailsResult } from "./types";

const RAKUTEN_SENDERS = ["order@rakuten.co.jp"];

export class RakutenProvider implements EmailProvider {
  readonly source = "rakuten" as const;

  buildQuery(options: GetEmailsOptions): string {
    const fromConditions = RAKUTEN_SENDERS.map((s) => `from:${s}`).join(" OR ");
    const forwardedCondition = "subject:fwd 楽天市場 注文内容ご確認";

    let query = `(${fromConditions} OR (${forwardedCondition}))`;

    if (options.dateFilter?.after) {
      query += ` after:${options.dateFilter.after.replace(/-/g, "/")}`;
    }
    if (options.dateFilter?.before) {
      query += ` before:${options.dateFilter.before.replace(/-/g, "/")}`;
    }

    return query;
  }

  async getEmails(accessToken: string, options: GetEmailsOptions): Promise<GetEmailsResult> {
    const query = this.buildQuery(options);
    return fetchAndParseEmails(accessToken, query, this.source, options);
  }

  getDefaultReceiptUrl(_orderNumber: string): string {
    return "https://order.my.rakuten.co.jp/";
  }
}
```

- [ ] **Step 4: レジストリに楽天プロバイダーを登録**

`src/lib/providers/index.ts` の `providers.set("amazon", ...)` の後に追加:

```typescript
import { RakutenProvider } from "./rakuten";
// ...
providers.set("rakuten", new RakutenProvider());
```

- [ ] **Step 5: テストを実行**

Run: `npx vitest run src/lib/__tests__/providers.test.ts`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/providers/ src/lib/__tests__/providers.test.ts
git commit -m "feat: 楽天プロバイダーを実装"
```

---

### Task 6: Gemini 解析に source パラメータを追加

**Files:**
- Modify: `src/lib/gemini.ts`
- Modify: `src/lib/__tests__/gemini.test.ts`

- [ ] **Step 1: テストを更新**

`src/lib/__tests__/gemini.test.ts` の変更:

1. 既存の全 `analyzeEmailWithGemini` 呼び出しに第3引数 `"amazon"` を追加
2. ファイル末尾に楽天テストを追加:

```typescript
describe("楽天メール解析", () => {
  const validRakutenOrderJson = JSON.stringify({
    orderDate: "2026-01-10",
    orderNumber: "393703-20260110-0005400563",
    items: [
      { name: "ターナー アイアンペイント200ml 黒皮鉄ブラック", quantity: 1, price: 1587 },
      { name: "ターナー アイアンペイント200ml ライトゴールド", quantity: 1, price: 1088 },
    ],
    totalAmount: 4851,
    tax: 441,
    receiptUrl: "",
  });

  it("楽天用プロンプトで解析する", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => validRakutenOrderJson },
    });

    const result = await analyzeEmailWithGemini("<html>楽天注文メール</html>", "key", "rakuten");

    expect(result).not.toBeNull();
    expect(result!.orderNumber).toBe("393703-20260110-0005400563");
    expect(result!.totalAmount).toBe(4851);

    // 楽天用プロンプトが使用されたことを確認
    const calledWith = mockGenerateContent.mock.calls[0][0] as string;
    expect(calledWith).toContain("楽天市場");
  });

  it("source を省略すると Amazon プロンプトが使われる", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => validRakutenOrderJson },
    });

    await analyzeEmailWithGemini("<html>test</html>", "key");

    const calledWith = mockGenerateContent.mock.calls[0][0] as string;
    expect(calledWith).toContain("Amazon");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/__tests__/gemini.test.ts 2>&1 | tail -10`
Expected: FAIL — source パラメータ未対応

- [ ] **Step 3: gemini.ts を更新**

変更内容:

1. `EmailSource` をインポート:
```typescript
import { ParsedOrder, EmailSource } from "./types";
```

2. 既存の `EXTRACTION_PROMPT` の後に `RAKUTEN_EXTRACTION_PROMPT` を追加:

```typescript
const RAKUTEN_EXTRACTION_PROMPT = `あなたは楽天市場の注文確認メールから注文情報を抽出するアシスタントです。
以下のHTMLメール本文から、注文情報を抽出してJSON形式で返してください。
メールが転送メール（Fwd:）の場合も、転送元の本文から情報を抽出してください。

抽出する項目:
- orderDate: 注文日（YYYY-MM-DD形式）。「注文日時」の日付部分を使用。
- orderNumber: 注文番号（例: 393703-20260110-0005400563）
- items: 商品リスト（各商品のname, quantity, price）。priceは税込の単価。
- totalAmount: 支払い金額（数値、円単位）。「支払い金額」の記載から取得。
- tax: 消費税額（数値、円単位）。楽天メールでは消費税額が明示されていないことが多い。その場合は合計金額の10/110を概算値として算出（小数点以下切り捨て）。算出不能な場合は0。
- receiptUrl: 領収書URL（メール内にリンクがあれば。なければ空文字）

注意:
- 金額は数値のみ（カンマや￥記号は除去）。例: 1,587円 → 1587
- 「X,XXX円 x N個 = X,XXX円」パターンから各商品の単価と数量を読み取る
- 複数商品がある場合はitemsに全て含める
- 情報が見つからない場合はnullを返す
- 必ずJSON形式のみで返してください（説明文は不要）

メール本文:
`;
```

3. プロンプト選択ヘルパーを追加:

```typescript
function getPromptForSource(source: EmailSource): string {
  switch (source) {
    case "rakuten":
      return RAKUTEN_EXTRACTION_PROMPT;
    case "amazon":
    default:
      return EXTRACTION_PROMPT;
  }
}
```

4. `toParsedOrder` に `source` パラメータを追加:

```typescript
function toParsedOrder(parsed: Record<string, unknown>, source: EmailSource): ParsedOrder {
  return {
    orderDate: typeof parsed.orderDate === "string" ? parsed.orderDate : "",
    orderNumber: typeof parsed.orderNumber === "string" ? parsed.orderNumber : "",
    items: Array.isArray(parsed.items)
      ? parsed.items.map(
          (item: { name?: string; quantity?: number; price?: number }) => ({
            name: item.name || "",
            quantity: item.quantity || 1,
            price: item.price || 0,
          })
        )
      : [],
    totalAmount: Number(parsed.totalAmount) || 0,
    tax: Number(parsed.tax) || 0,
    receiptUrl: typeof parsed.receiptUrl === "string" ? parsed.receiptUrl : "",
    source,
  };
}
```

5. `analyzeEmailWithGemini` のシグネチャを更新:

```typescript
export async function analyzeEmailWithGemini(
  emailHtml: string,
  apiKey: string,
  source: EmailSource = "amazon"
): Promise<ParsedOrder | null> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const truncatedHtml =
    emailHtml.length > 30000 ? emailHtml.substring(0, 30000) : emailHtml;

  const prompt = getPromptForSource(source);

  const result = await withRetry(
    () => model.generateContent(prompt + truncatedHtml),
    // ... 既存のリトライ設定
  );

  // ... 既存の response 処理 ...

  try {
    return toParsedOrder(extracted as Record<string, unknown>, source);
  } catch {
    return null;
  }
}
```

6. `analyzeEmailsBatch` にも `source` を追加:

```typescript
export async function analyzeEmailsBatch(
  emails: Array<{ id: string; body: string }>,
  apiKey: string,
  source: EmailSource = "amazon"
): Promise<{
  results: BatchAnalysisResult[];
  successCount: number;
  failureCount: number;
}> {
  // ... 既存ロジック、analyzeEmailWithGemini 呼び出しに source を渡す:
  const order = await analyzeEmailWithGemini(email.body, apiKey, source);
  // ...
}
```

- [ ] **Step 4: テストを実行**

Run: `npx vitest run src/lib/__tests__/gemini.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/gemini.ts src/lib/__tests__/gemini.test.ts
git commit -m "feat: Gemini解析にsourceパラメータと楽天用プロンプトを追加"
```

---

### Task 7: Sheets エクスポートの7列化

**Files:**
- Modify: `src/lib/sheets.ts`
- Modify: `src/lib/__tests__/sheets.test.ts`

- [ ] **Step 1: テストを更新**

`src/lib/__tests__/sheets.test.ts` の変更:

1. `sampleOrders` に `source: "amazon"` を追加:
```typescript
const sampleOrders: ParsedOrder[] = [
  {
    // ... 既存フィールド ...
    source: "amazon",
  },
];
```

2. `ordersNoUrl` にも `source: "amazon"` を追加

3. ヘッダーの検証を更新（「ソース」列を含む）

4. データ行の列インデックスを更新（5→ソース, 6→領収書リンク）:
```typescript
// rows[0][5] はソース
expect(rows[0][5]).toBe("Amazon");
// rows[0][6] は領収書リンク
expect(rows[0][6]).toBe("https://www.amazon.co.jp/receipt/123");
```

5. 以下のテストケースを追加:

```typescript
it("旧6列ヘッダーの場合は7列ヘッダーに更新する", async () => {
  mockValuesGet.mockResolvedValue({
    data: { values: [["注文日", "注文番号", "商品名", "金額", "消費税", "領収書リンク"]] },
  });
  mockValuesUpdate.mockResolvedValue({});
  mockValuesAppend.mockResolvedValue({
    data: { updates: { updatedRows: 1 } },
  });

  await exportToSheet("token", "sheet-id", sampleOrders);

  expect(mockValuesUpdate).toHaveBeenCalledOnce();
  const updateCall = mockValuesUpdate.mock.calls[0][0];
  expect(updateCall.requestBody.values[0]).toContain("ソース");
  expect(updateCall.range).toBe("Sheet1!A1:G1");
});

it("楽天注文でソース列が楽天になる", async () => {
  const rakutenOrders: ParsedOrder[] = [
    {
      orderDate: "2026-01-10",
      orderNumber: "393703-20260110-0005400563",
      items: [{ name: "商品X", quantity: 1, price: 1587 }],
      totalAmount: 1587,
      tax: 144,
      receiptUrl: "",
      source: "rakuten",
    },
  ];

  mockValuesGet.mockResolvedValue({
    data: { values: [["header", "header", "header", "header", "header", "header", "header"]] },
  });
  mockValuesAppend.mockResolvedValue({
    data: { updates: { updatedRows: 1 } },
  });

  await exportToSheet("token", "sheet-id", rakutenOrders);

  const rows = mockValuesAppend.mock.calls[0][0].requestBody.values;
  expect(rows[0][5]).toBe("楽天");
  expect(rows[0][6]).toBe("https://order.my.rakuten.co.jp/");
});
```

6. `createSpreadsheet` テストも更新:
```typescript
it("作成リクエストにソース列を含むヘッダー行が含まれる", async () => {
  // ... 既存セットアップ ...
  const headerTexts = rowData.map(/* ... */);
  expect(headerTexts).toContain("ソース");
});

it("スプレッドシートタイトルがEC経費管理で始まる", async () => {
  // ... 既存セットアップ ...
  const createCall = mockSpreadsheetsCreate.mock.calls[0][0];
  expect(createCall.requestBody.properties.title).toMatch(/^EC経費管理_/);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/__tests__/sheets.test.ts 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: sheets.ts を更新**

`src/lib/sheets.ts` の変更:

```typescript
import { google } from "googleapis";
import { ParsedOrder } from "./types";
import { withRetry } from "./retry";
import { getProvider } from "./providers";

const SHEETS_RETRY_OPTIONS = { /* 既存のまま */ };

const HEADERS = ["注文日", "注文番号", "商品名", "金額", "消費税", "ソース", "領収書リンク"];

export async function exportToSheet(
  accessToken: string,
  spreadsheetId: string,
  orders: ParsedOrder[]
): Promise<{ updatedRows: number }> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const sheets = google.sheets({ version: "v4", auth });

  // ヘッダー行チェック
  const headerCheck = await withRetry(
    () =>
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Sheet1!A1:G1",
      }),
    SHEETS_RETRY_OPTIONS
  );

  const existingHeaders = headerCheck.data.values?.[0];
  if (!existingHeaders || existingHeaders.length === 0) {
    // ヘッダーなし → 新規作成
    await withRetry(
      () =>
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "Sheet1!A1:G1",
          valueInputOption: "RAW",
          requestBody: { values: [HEADERS] },
        }),
      SHEETS_RETRY_OPTIONS
    );
  } else if (existingHeaders.length <= 6 && !existingHeaders.includes("ソース")) {
    // 旧6列ヘッダー → 7列に更新
    await withRetry(
      () =>
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "Sheet1!A1:G1",
          valueInputOption: "RAW",
          requestBody: { values: [HEADERS] },
        }),
      SHEETS_RETRY_OPTIONS
    );
  }

  const rows = orders.flatMap((order) => {
    const sourceLabel = order.source === "amazon" ? "Amazon" : "楽天";
    const receiptUrl = order.receiptUrl || getProvider(order.source).getDefaultReceiptUrl(order.orderNumber);

    return order.items.map((item) => [
      order.orderDate,
      order.orderNumber,
      item.name,
      item.price,
      order.tax,
      sourceLabel,
      receiptUrl,
    ]);
  });

  if (rows.length === 0) return { updatedRows: 0 };

  const appendResult = await withRetry(
    () =>
      sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Sheet1!A:G",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      }),
    SHEETS_RETRY_OPTIONS
  );

  return {
    updatedRows: appendResult.data.updates?.updatedRows || 0,
  };
}

export async function createSpreadsheet(
  accessToken: string
): Promise<{ spreadsheetId: string; url: string }> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const sheets = google.sheets({ version: "v4", auth });

  const response = await withRetry(
    () =>
      sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: `EC経費管理_${new Date().toISOString().split("T")[0]}`,
          },
          sheets: [
            {
              properties: { title: "Sheet1" },
              data: [
                {
                  startRow: 0,
                  startColumn: 0,
                  rowData: [
                    {
                      values: HEADERS.map((header) => ({
                        userEnteredValue: { stringValue: header },
                        userEnteredFormat: { textFormat: { bold: true } },
                      })),
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    SHEETS_RETRY_OPTIONS
  );

  return {
    spreadsheetId: response.data.spreadsheetId!,
    url: response.data.spreadsheetUrl!,
  };
}
```

- [ ] **Step 4: テストを実行**

Run: `npx vitest run src/lib/__tests__/sheets.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/sheets.ts src/lib/__tests__/sheets.test.ts
git commit -m "feat: Sheetsエクスポートを7列化しソース列を追加"
```

---

### Task 8: CSV エクスポートの更新

**Files:**
- Modify: `src/lib/csv-export.ts`
- Create: `src/lib/__tests__/csv-export.test.ts`

- [ ] **Step 1: テストを作成**

`src/lib/__tests__/csv-export.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ordersToCSV } from "../csv-export";
import type { ParsedOrder } from "../types";

describe("ordersToCSV", () => {
  const amazonOrder: ParsedOrder = {
    orderDate: "2025-01-15",
    orderNumber: "250-1234567-7654321",
    items: [{ name: "テスト商品A", quantity: 2, price: 1500 }],
    totalAmount: 3000,
    tax: 273,
    receiptUrl: "https://www.amazon.co.jp/receipt/123",
    source: "amazon",
  };

  const rakutenOrder: ParsedOrder = {
    orderDate: "2026-01-10",
    orderNumber: "393703-20260110-0005400563",
    items: [{ name: "アイアンペイント", quantity: 1, price: 1587 }],
    totalAmount: 1587,
    tax: 144,
    receiptUrl: "",
    source: "rakuten",
  };

  it("ヘッダーにソース列が含まれる", () => {
    const csv = ordersToCSV([amazonOrder]);
    const headerLine = csv.split("\n")[0];
    expect(headerLine).toContain("ソース");
  });

  it("Amazon注文のソースがAmazonと表示される", () => {
    const csv = ordersToCSV([amazonOrder]);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain("Amazon");
  });

  it("楽天注文のソースが楽天と表示される", () => {
    const csv = ordersToCSV([rakutenOrder]);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain("楽天");
  });

  it("楽天注文でreceiptUrlが空の場合はデフォルトURLを使用する", () => {
    const csv = ordersToCSV([rakutenOrder]);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain("https://order.my.rakuten.co.jp/");
  });

  it("Amazon注文でreceiptUrlが空の場合はAmazonデフォルトURLを使用する", () => {
    const orderNoUrl: ParsedOrder = { ...amazonOrder, receiptUrl: "" };
    const csv = ordersToCSV([orderNoUrl]);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain("amazon.co.jp/gp/css/summary/print.html");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/__tests__/csv-export.test.ts 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: csv-export.ts を更新**

`src/lib/csv-export.ts`:

```typescript
import { ParsedOrder } from "./types";
import { getProvider } from "./providers";

function escapeCsvCell(value: string): string {
  if (
    value.includes('"') ||
    value.includes(",") ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function ordersToCSV(orders: ParsedOrder[]): string {
  const headers = [
    "注文日",
    "注文番号",
    "商品名",
    "数量",
    "金額",
    "消費税",
    "合計金額",
    "ソース",
    "領収書リンク",
  ];

  const rows: string[][] = [];

  for (const order of orders) {
    const sourceLabel = order.source === "amazon" ? "Amazon" : "楽天";
    const receiptUrl = order.receiptUrl || getProvider(order.source).getDefaultReceiptUrl(order.orderNumber);

    for (const item of order.items) {
      rows.push([
        order.orderDate,
        order.orderNumber,
        item.name,
        String(item.quantity),
        String(item.price),
        String(order.tax),
        String(order.totalAmount),
        sourceLabel,
        receiptUrl,
      ]);
    }
  }

  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(","));

  return headerLine + "\n" + dataLines.join("\n");
}

export function createCsvBlob(csvString: string): Blob {
  const BOM = "\uFEFF";
  return new Blob([BOM + csvString], { type: "text/csv;charset=utf-8" });
}

export function downloadCsv(orders: ParsedOrder[], filename?: string): void {
  const csv = ordersToCSV(orders);
  const blob = createCsvBlob(csv);
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename || `ec_orders_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: テストを実行**

Run: `npx vitest run src/lib/__tests__/csv-export.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/csv-export.ts src/lib/__tests__/csv-export.test.ts
git commit -m "feat: CSVエクスポートにソース列を追加"
```

---

### Task 9: API ルートの更新

**Files:**
- Modify: `src/app/api/gmail/route.ts`
- Modify: `src/app/api/analyze/route.ts`

- [ ] **Step 1: /api/gmail を更新**

`src/app/api/gmail/route.ts` を以下のように書き換え:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProvider } from "@/lib/providers";
import type { EmailSource } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { errorTracker } from "@/lib/error-tracker";
import { metrics } from "@/lib/metrics";
import { toAppError, errorToResponse } from "@/lib/errors";

const log = logger.child({ route: "/api/gmail" });

const RATE_LIMIT_OPTIONS = { windowMs: 60_000, maxRequests: 10 };

export async function GET(request: NextRequest) {
  const endRequest = metrics.startRequest("/api/gmail");

  const session = await auth();
  if (!session?.accessToken) {
    log.warn("Unauthorized request");
    metrics.recordFailure("/api/gmail");
    endRequest();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitKey = `gmail:${session.accessToken.slice(-16)}`;
  const rl = rateLimit(rateLimitKey, RATE_LIMIT_OPTIONS);
  if (!rl.allowed) {
    log.warn("Rate limit exceeded", { retryAfterMs: rl.retryAfterMs });
    metrics.recordFailure("/api/gmail");
    endRequest();
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    const providerParam = request.nextUrl.searchParams.get("provider") ?? "amazon";
    const source: EmailSource = (["amazon", "rakuten"].includes(providerParam)
      ? providerParam
      : "amazon") as EmailSource;

    log.info("Fetching emails", { provider: source });

    const pageToken = request.nextUrl.searchParams.get("pageToken") ?? undefined;
    const after = request.nextUrl.searchParams.get("after") ?? undefined;
    const before = request.nextUrl.searchParams.get("before") ?? undefined;
    const regionParam = request.nextUrl.searchParams.get("region") ?? "jp";

    const dateFilter = after || before ? { after, before } : undefined;

    const provider = getProvider(source);
    const result = await provider.getEmails(session.accessToken, {
      maxResults: 20,
      pageToken,
      dateFilter,
      region: source === "amazon" ? regionParam : undefined,
    });

    log.info("Emails fetched successfully", { count: result.emails.length });
    metrics.recordSuccess("/api/gmail");
    endRequest();
    return NextResponse.json({
      emails: result.emails,
      nextPageToken: result.nextPageToken,
    });
  } catch (error) {
    const appError = toAppError(error, "GMAIL_FETCH_FAILED");
    console.error("Gmail API error:", error);
    log.error("Gmail API request failed", {
      error: error instanceof Error ? error.message : String(error),
      errorCode: appError.code,
    });
    errorTracker.captureException(error, { module: "api/gmail" });
    metrics.recordFailure("/api/gmail");
    endRequest();
    const { body, status } = errorToResponse(appError);
    return NextResponse.json(body, { status });
  }
}
```

- [ ] **Step 2: /api/analyze POST を更新**

`src/app/api/analyze/route.ts` の POST handler 変更:

1. `EmailSource` をインポート
2. リクエストボディから `source` を取得
3. キャッシュキーを `${source}:${emailId}` に
4. `analyzeEmailWithGemini` に `source` を渡す
5. 戻り値の `order` に `source` を付与

```typescript
import type { EmailSource } from "@/lib/types";

// POST handler 内:
const { emailHtml, emailId, source: sourceParam } = body as {
  emailHtml?: unknown;
  emailId?: unknown;
  source?: unknown;
};

const source: EmailSource = (
  typeof sourceParam === "string" && ["amazon", "rakuten"].includes(sourceParam)
    ? sourceParam
    : "amazon"
) as EmailSource;

// キャッシュキー
const cacheKey = typeof emailId === "string" && emailId.length > 0
  ? `${source}:${emailId}`
  : null;

if (cacheKey) {
  const cached = analysisCache.get(cacheKey);
  if (cached !== undefined) {
    log.info("Cache hit for email analysis", { emailId });
    metrics.recordSuccess("/api/analyze");
    endRequest();
    return NextResponse.json({ order: cached, cached: true });
  }
}

const order = await analyzeEmailWithGemini(emailHtml as string, apiKey, source);

if (cacheKey) {
  analysisCache.set(cacheKey, order);
}
```

- [ ] **Step 3: /api/analyze PATCH を更新**

PATCH handler 変更:

```typescript
// PATCH handler 内:
const { emails, source: sourceParam } = body as {
  emails?: Array<{ id: string; body: string }>;
  source?: unknown;
};

const source: EmailSource = (
  typeof sourceParam === "string" && ["amazon", "rakuten"].includes(sourceParam)
    ? sourceParam
    : "amazon"
) as EmailSource;

// analyzeEmailsBatch に source を渡す
const batchResult = await analyzeEmailsBatch(emails, apiKey, source);

// 成功した結果をキャッシュに保存（source付きキー）
for (const result of batchResult.results) {
  if (result.order) {
    result.order.source = source;
    analysisCache.set(`${source}:${result.emailId}`, result.order);
  }
}
```

- [ ] **Step 4: gmail.ts から互換シムを削除**

Task 3 で残しておいた `getAmazonEmails` 互換シムと関連コード（`AmazonRegion` 定義, `AMAZON_SENDERS_*`, `getSendersForRegion`, `buildAmazonQuery`, `GetAmazonEmailsResult`）を `src/lib/gmail.ts` から削除する。

`AmazonRegion` は `src/lib/providers/amazon.ts` と `src/lib/providers/index.ts` からエクスポートされているため、他ファイルからの参照は不要。

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: 残りのUI関連の型エラーのみ（次のタスクで修正）

- [ ] **Step 6: コミット**

```bash
git add src/app/api/gmail/route.ts src/app/api/analyze/route.ts src/lib/gmail.ts
git commit -m "feat: APIルートにprovider/sourceパラメータを追加、互換シム削除"
```

---

### Task 10: UI変更（タブ、EmailList、SortableTable）

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/EmailList.tsx`
- Modify: `src/components/SortableTable.tsx`

- [ ] **Step 1: page.tsx にタブUIを追加**

主な変更:
1. `import type { AmazonRegion } from "@/lib/gmail"` を `import type { AmazonRegion } from "@/lib/providers"` に変更
2. `provider` ステートを追加: `const [provider, setProvider] = useState<EmailSource>("amazon");`
3. `EmailSource` をインポート: `import { EmailSource } from "@/lib/types";`
4. タブ切り替え時にメール一覧・解析結果をリセット
5. `region` セレクトは `provider === "amazon"` の場合のみ表示
6. `fetchEmails` で `provider` パラメータをAPIに渡す: `params.set("provider", provider)`
7. `analyzeEmails` で `source` パラメータをAPIに渡す: `body: JSON.stringify({ emailHtml: email.body, emailId: email.id, source: provider })`
8. ログイン前タイトルを「EC経費管理」に変更
9. ステップ1のタイトルを動的に
10. `EmailList` に `provider` prop を渡す

タブUIコンポーネント（`return` 文の `<main>` 直下、`{loading && ...}` の前に追加）:
```tsx
<div className="mb-4 flex border-b border-gray-200 dark:border-gray-700">
  {(["amazon", "rakuten"] as const).map((p) => (
    <button
      key={p}
      onClick={() => {
        if (p !== provider) {
          setProvider(p);
          setEmails([]);
          setResults([]);
          setSelectedIds(new Set());
          setSpreadsheetUrl(null);
        }
      }}
      className={`px-4 py-2 text-sm font-medium ${
        provider === p
          ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
          : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      }`}
    >
      {p === "amazon" ? "Amazon" : "楽天市場"}
    </button>
  ))}
</div>
```

- [ ] **Step 2: EmailList.tsx を更新**

```tsx
import { AmazonEmail, EmailSource } from "@/lib/types";

interface EmailListProps {
  emails: AmazonEmail[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  provider?: EmailSource;
}

export default function EmailList({
  emails,
  selectedIds,
  onToggle,
  onSelectAll,
  provider = "amazon",
}: EmailListProps) {
  if (emails.length === 0) {
    const emptyMessage = provider === "rakuten"
      ? "楽天市場からの注文確認メールが見つかりませんでした"
      : "Amazonからの注文確認メールが見つかりませんでした";

    return (
      <div className="rounded-lg border border-gray-200 p-8 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  // ... 残りは既存のまま
```

- [ ] **Step 3: SortableTable.tsx を更新**

1. `EmailSource` と `getProvider` をインポート
2. `FlatRow` に `source: EmailSource` を追加
3. `flattenResults` で `source` を設定（`result.email.source` を使用、フォールバックは `"amazon"`）
4. 領収書URLのデフォルトをプロバイダーから取得
5. テーブルヘッダーに「ソース」列を追加
6. データ行にソース表示を追加

`flattenResults` の変更:
```typescript
import { EmailSource } from "@/lib/types";
import { getProvider } from "@/lib/providers";

interface FlatRow {
  emailId: string;
  orderDate: string;
  orderNumber: string;
  itemName: string;
  itemPrice: number;
  tax: number;
  receiptUrl: string;
  source: EmailSource;
}

function flattenResults(results: AnalysisResult[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const result of results) {
    if (!result.order) continue;
    const order = result.order;
    const source = order.source ?? result.email.source ?? "amazon";
    for (const item of order.items) {
      rows.push({
        emailId: result.email.id,
        orderDate: order.orderDate,
        orderNumber: order.orderNumber,
        itemName: item.name,
        itemPrice: item.price,
        tax: order.tax,
        receiptUrl: order.receiptUrl || getProvider(source).getDefaultReceiptUrl(order.orderNumber),
        source,
      });
    }
  }
  return rows;
}
```

テーブルヘッダーに追加（「注文番号」の後、「商品名」の前に）:
```tsx
<th className="whitespace-nowrap px-4 py-2">ソース</th>
```

データ行に追加:
```tsx
<td className="whitespace-nowrap px-4 py-2 dark:text-gray-200">
  {row.source === "amazon" ? "Amazon" : "楽天"}
</td>
```

- [ ] **Step 4: コミット**

```bash
git add src/app/page.tsx src/components/EmailList.tsx src/components/SortableTable.tsx
git commit -m "feat: タブUI、EmailList、SortableTableを楽天対応に更新"
```

---

### Task 11: 既存テストの修正

**Files:**
- Modify: `src/lib/__tests__/gmail.test.ts`

- [ ] **Step 1: gmail.test.ts を extractBody テストに書き換え**

`getAmazonEmails` は互換シム削除済みのため、`extractBody` のテストに書き換える:

```typescript
import { describe, it, expect } from "vitest";
import { extractBody } from "../gmail";

function base64Encode(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64");
}

describe("extractBody", () => {
  it("text/html ペイロードからHTMLを抽出する", () => {
    const html = "<html>テスト</html>";
    const result = extractBody({
      mimeType: "text/html",
      body: { data: base64Encode(html) },
    });
    expect(result).toBe(html);
  });

  it("multipart/alternative からHTML部分を抽出する", () => {
    const html = "<html>マルチパート</html>";
    const result = extractBody({
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: base64Encode("plain") } },
        { mimeType: "text/html", body: { data: base64Encode(html) } },
      ],
    });
    expect(result).toBe(html);
  });

  it("ネストされたパーツからHTMLを抽出する", () => {
    const html = "<html>ネスト</html>";
    const result = extractBody({
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/html", body: { data: base64Encode(html) } },
          ],
        },
      ],
    });
    expect(result).toBe(html);
  });

  it("null ペイロードの場合は空文字を返す", () => {
    expect(extractBody(null)).toBe("");
  });

  it("bodyデータがないペイロードの場合は空文字を返す", () => {
    const result = extractBody({
      mimeType: "multipart/mixed",
      parts: [{ mimeType: "text/plain", body: {} }],
    });
    expect(result).toBe("");
  });
});
```

- [ ] **Step 2: 全テストを実行**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: コミット**

```bash
git add src/lib/__tests__/gmail.test.ts
git commit -m "test: gmail.testをextractBodyテストに書き換え"
```

---

### Task 12: ビルド確認と最終チェック

**Files:** なし（確認のみ）

- [ ] **Step 1: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 2: 全テスト実行**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 4: lint チェック**

Run: `npm run lint`
Expected: エラーなし

- [ ] **Step 5: 最終コミット（必要な場合のみ）**

ビルドやlintで修正が必要だった場合のみコミット。
