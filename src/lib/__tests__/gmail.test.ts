import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAmazonEmails } from "../gmail";

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

function base64Encode(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64");
}

describe("getAmazonEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("メール一覧を取得して詳細を返す", async () => {
    mockMessagesList.mockResolvedValue({
      data: {
        messages: [
          { id: "msg1", threadId: "thread1" },
          { id: "msg2", threadId: "thread2" },
        ],
      },
    });

    const htmlBody = "<html><body>注文確認</body></html>";
    const encodedBody = base64Encode(htmlBody);

    mockMessagesGet.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve({
        data: {
          snippet: `Snippet for ${id}`,
          payload: {
            headers: [
              { name: "Subject", value: `Subject ${id}` },
              { name: "Date", value: "Mon, 15 Jan 2025 10:00:00 +0900" },
            ],
            mimeType: "text/html",
            body: { data: encodedBody },
          },
        },
      })
    );

    const emails = await getAmazonEmails("test-token", 10);

    expect(emails).toHaveLength(2);
    expect(emails[0].id).toBe("msg1");
    expect(emails[0].subject).toBe("Subject msg1");
    expect(emails[0].body).toBe(htmlBody);
    expect(emails[1].id).toBe("msg2");
  });

  it("メッセージが空の場合は空配列を返す", async () => {
    mockMessagesList.mockResolvedValue({
      data: { messages: undefined },
    });

    const emails = await getAmazonEmails("test-token");
    expect(emails).toEqual([]);
  });

  it("multipart/alternative のメールからHTML本文を抽出する", async () => {
    const htmlContent = "<html><body>Amazon注文</body></html>";

    mockMessagesList.mockResolvedValue({
      data: { messages: [{ id: "msg1", threadId: "t1" }] },
    });

    mockMessagesGet.mockResolvedValue({
      data: {
        snippet: "test",
        payload: {
          mimeType: "multipart/alternative",
          headers: [
            { name: "Subject", value: "注文確認" },
            { name: "Date", value: "2025-01-15" },
          ],
          parts: [
            {
              mimeType: "text/plain",
              body: { data: base64Encode("プレーンテキスト") },
            },
            {
              mimeType: "text/html",
              body: { data: base64Encode(htmlContent) },
            },
          ],
        },
      },
    });

    const emails = await getAmazonEmails("test-token");

    expect(emails).toHaveLength(1);
    expect(emails[0].body).toBe(htmlContent);
  });

  it("ネストされたパーツからHTML本文を抽出する", async () => {
    const htmlContent = "<html>ネスト内容</html>";

    mockMessagesList.mockResolvedValue({
      data: { messages: [{ id: "msg1", threadId: "t1" }] },
    });

    mockMessagesGet.mockResolvedValue({
      data: {
        snippet: "test",
        payload: {
          mimeType: "multipart/mixed",
          headers: [
            { name: "Subject", value: "テスト" },
            { name: "Date", value: "2025-01-15" },
          ],
          parts: [
            {
              mimeType: "multipart/alternative",
              parts: [
                {
                  mimeType: "text/html",
                  body: { data: base64Encode(htmlContent) },
                },
              ],
            },
          ],
        },
      },
    });

    const emails = await getAmazonEmails("test-token");
    expect(emails[0].body).toBe(htmlContent);
  });

  it("Subjectヘッダーがない場合は(no subject)を返す", async () => {
    mockMessagesList.mockResolvedValue({
      data: { messages: [{ id: "msg1", threadId: "t1" }] },
    });

    mockMessagesGet.mockResolvedValue({
      data: {
        snippet: "test",
        payload: {
          headers: [{ name: "Date", value: "2025-01-15" }],
          body: { data: base64Encode("body") },
        },
      },
    });

    const emails = await getAmazonEmails("test-token");
    expect(emails[0].subject).toBe("(no subject)");
  });

  it("payloadがnullの場合はbodyが空文字になる", async () => {
    mockMessagesList.mockResolvedValue({
      data: { messages: [{ id: "msg1", threadId: "t1" }] },
    });

    mockMessagesGet.mockResolvedValue({
      data: {
        snippet: "test",
        payload: null,
      },
    });

    const emails = await getAmazonEmails("test-token");
    expect(emails[0].body).toBe("");
  });

  it("bodyデータがないパーツの場合はフォールバックする", async () => {
    mockMessagesList.mockResolvedValue({
      data: { messages: [{ id: "msg1", threadId: "t1" }] },
    });

    mockMessagesGet.mockResolvedValue({
      data: {
        snippet: "",
        payload: {
          mimeType: "multipart/mixed",
          headers: [],
          parts: [
            { mimeType: "text/plain", body: {} },
          ],
        },
      },
    });

    const emails = await getAmazonEmails("test-token");
    expect(emails[0].body).toBe("");
    expect(emails[0].subject).toBe("(no subject)");
    expect(emails[0].date).toBe("");
  });

  it("Gmail APIエラーが伝播する", async () => {
    mockMessagesList.mockRejectedValue(new Error("Gmail API error"));

    await expect(getAmazonEmails("bad-token")).rejects.toThrow("Gmail API error");
  });
});
