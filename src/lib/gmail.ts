import { google } from "googleapis";
import { OrderEmail, EmailSource } from "./types";
import { withRetry } from "./retry";
import { GmailDateFilter, GetEmailsOptions, GetEmailsResult } from "./providers/types";

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
