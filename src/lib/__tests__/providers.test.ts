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
    expect(query).toContain("from:shipment-tracking@amazon.co.jp");
    expect(query).not.toContain("amazon.com");
  });

  it("USリージョンのクエリを構築する", () => {
    const query = provider.buildQuery({ region: "us" });
    expect(query).toContain("from:shipment-tracking@amazon.com");
    expect(query).not.toContain("amazon.co.jp");
  });

  it("allリージョンで両方の送信元を含む", () => {
    const query = provider.buildQuery({ region: "all" });
    expect(query).toContain("from:shipment-tracking@amazon.co.jp");
    expect(query).toContain("from:shipment-tracking@amazon.com");
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
      "https://www.amazon.co.jp/gp/your-account/order-details?orderID=250-1234567-7654321"
    );
  });

  it("メッセージが0件の場合は空配列を返す", async () => {
    mockMessagesList.mockResolvedValue({
      data: { messages: [] },
    });

    const result = await provider.getEmails("token", {});
    expect(result.emails).toHaveLength(0);
  });
});

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

  it("メッセージが0件の場合は空配列を返す", async () => {
    mockMessagesList.mockResolvedValue({
      data: { messages: [] },
    });

    const result = await provider.getEmails("token", {});
    expect(result.emails).toHaveLength(0);
  });
});
