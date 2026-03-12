import { google } from "googleapis";
import { AmazonEmail } from "./types";

const AMAZON_SENDERS = [
  "auto-confirm@amazon.co.jp",
  "ship-confirm@amazon.co.jp",
  "order-update@amazon.co.jp",
];

const AMAZON_QUERY = AMAZON_SENDERS.map((s) => `from:${s}`).join(" OR ");

export async function getAmazonEmails(
  accessToken: string,
  maxResults: number = 20
): Promise<AmazonEmail[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth });

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: AMAZON_QUERY,
    maxResults,
  });

  const messages = listResponse.data.messages || [];
  const emails: AmazonEmail[] = [];

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "full",
    });

    const headers = detail.data.payload?.headers || [];
    const subject =
      headers.find((h) => h.name === "Subject")?.value || "(no subject)";
    const date = headers.find((h) => h.name === "Date")?.value || "";

    const body = extractBody(detail.data.payload);

    emails.push({
      id: msg.id!,
      threadId: msg.threadId!,
      subject,
      date,
      snippet: detail.data.snippet || "",
      body,
    });
  }

  return emails;
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
