import { google } from "googleapis";
import { AmazonEmail } from "./types";
import { withRetry } from "./retry";

const AMAZON_SENDERS = [
  "auto-confirm@amazon.co.jp",
  "ship-confirm@amazon.co.jp",
  "order-update@amazon.co.jp",
];

const AMAZON_QUERY = AMAZON_SENDERS.map((s) => `from:${s}`).join(" OR ");

/** 並列取得の最大同時実行数 */
const MAX_CONCURRENCY = 5;

const GMAIL_RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  onRetry: (attempt: number, error: unknown, delayMs: number) => {
    console.warn(
      `[Gmail] リトライ ${attempt}/3 (${delayMs}ms後): ${error instanceof Error ? error.message : String(error)}`
    );
  },
};

export interface GetAmazonEmailsResult {
  emails: AmazonEmail[];
  nextPageToken?: string;
}

/**
 * 並列実行数を制御しながら非同期タスクを実行する
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
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

export async function getAmazonEmails(
  accessToken: string,
  maxResults: number = 20,
  pageToken?: string
): Promise<GetAmazonEmailsResult> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth });

  const listResponse = await withRetry(
    () =>
      gmail.users.messages.list({
        userId: "me",
        q: AMAZON_QUERY,
        maxResults,
        pageToken,
      }),
    GMAIL_RETRY_OPTIONS
  );

  const messages = listResponse.data.messages || [];
  const nextPageToken = listResponse.data.nextPageToken ?? undefined;

  if (messages.length === 0) {
    return { emails: [], nextPageToken };
  }

  // メール詳細を並列取得（最大 MAX_CONCURRENCY 並列）
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

  const settled = await runWithConcurrency(tasks, MAX_CONCURRENCY);

  const emails: AmazonEmail[] = [];
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
    });
  }

  return { emails, nextPageToken };
}

function extractBody(
  payload: ReturnType<
    typeof google.gmail
  > extends { users: { messages: { get: (...args: unknown[]) => Promise<{ data: { payload?: infer P } }> } } }
    ? P
    : unknown
): string {
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
