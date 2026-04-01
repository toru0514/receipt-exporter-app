import { google, gmail_v1 } from "googleapis";
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

export function extractBody(payload: gmail_v1.Schema$MessagePart | undefined | null): string {
  if (!payload) return "";

  if (payload.mimeType === "text/html" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
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

