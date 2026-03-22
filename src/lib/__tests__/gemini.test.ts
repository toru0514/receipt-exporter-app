import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeEmailWithGemini } from "../gemini";

// Mock @google/generative-ai
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    getGenerativeModel = mockGetGenerativeModel;
  },
}));

describe("analyzeEmailWithGemini", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validOrderJson = JSON.stringify({
    orderDate: "2025-01-15",
    orderNumber: "250-1234567-7654321",
    items: [
      { name: "テスト商品A", quantity: 2, price: 1500 },
      { name: "テスト商品B", quantity: 1, price: 3000 },
    ],
    totalAmount: 6000,
    tax: 545,
    receiptUrl: "https://www.amazon.co.jp/receipt/123",
  });

  it("正常なGeminiレスポンスからParsedOrderを返す", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => validOrderJson },
    });

    const result = await analyzeEmailWithGemini("<html>テストメール</html>", "test-api-key");

    expect(result).not.toBeNull();
    expect(result!.orderDate).toBe("2025-01-15");
    expect(result!.orderNumber).toBe("250-1234567-7654321");
    expect(result!.items).toHaveLength(2);
    expect(result!.items[0].name).toBe("テスト商品A");
    expect(result!.items[0].quantity).toBe(2);
    expect(result!.items[0].price).toBe(1500);
    expect(result!.totalAmount).toBe(6000);
    expect(result!.tax).toBe(545);
    expect(result!.receiptUrl).toBe("https://www.amazon.co.jp/receipt/123");
  });

  it("JSONがマークダウンコードブロックで囲まれていてもパースできる", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "```json\n" + validOrderJson + "\n```" },
    });

    const result = await analyzeEmailWithGemini("<html>test</html>", "key");

    expect(result).not.toBeNull();
    expect(result!.orderNumber).toBe("250-1234567-7654321");
  });

  it("レスポンスにJSONが含まれない場合はnullを返す", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "情報を抽出できませんでした。" },
    });

    const result = await analyzeEmailWithGemini("<html>not an order</html>", "key");
    expect(result).toBeNull();
  });

  it("不正なJSONの場合はnullを返す", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "{ invalid json }" },
    });

    const result = await analyzeEmailWithGemini("<html>test</html>", "key");
    expect(result).toBeNull();
  });

  it("レスポンスがnull値のJSONの場合はnullを返す", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "null" },
    });

    const result = await analyzeEmailWithGemini("<html>test</html>", "key");
    expect(result).toBeNull();
  });

  it("不足しているフィールドにデフォルト値を設定する", async () => {
    const partialJson = JSON.stringify({
      orderDate: "2025-03-01",
      // orderNumber, receiptUrl missing
      items: [{ name: "商品X" }], // quantity, price missing
      totalAmount: "1000",
      // tax missing
    });

    mockGenerateContent.mockResolvedValue({
      response: { text: () => partialJson },
    });

    const result = await analyzeEmailWithGemini("<html>test</html>", "key");

    expect(result).not.toBeNull();
    expect(result!.orderNumber).toBe("");
    expect(result!.receiptUrl).toBe("");
    expect(result!.items[0].quantity).toBe(1);
    expect(result!.items[0].price).toBe(0);
    expect(result!.tax).toBe(0);
    expect(result!.totalAmount).toBe(1000);
  });

  it("itemsが配列でない場合は空配列にする", async () => {
    const badItemsJson = JSON.stringify({
      orderDate: "2025-01-01",
      orderNumber: "123",
      items: "not an array",
      totalAmount: 100,
    });

    mockGenerateContent.mockResolvedValue({
      response: { text: () => badItemsJson },
    });

    const result = await analyzeEmailWithGemini("<html>test</html>", "key");

    expect(result).not.toBeNull();
    expect(result!.items).toEqual([]);
  });

  it("30000文字を超えるHTMLは切り詰められる", async () => {
    const longHtml = "a".repeat(50000);
    mockGenerateContent.mockResolvedValue({
      response: { text: () => validOrderJson },
    });

    await analyzeEmailWithGemini(longHtml, "key");

    const calledWith = mockGenerateContent.mock.calls[0][0] as string;
    // Prompt + truncated HTML should be shorter than prompt + 50000
    expect(calledWith.length).toBeLessThan(50000);
    // But should contain the full prompt plus 30000 chars of HTML
    expect(calledWith.length).toBeGreaterThan(30000);
  });

  it("Gemini APIがエラーをスローした場合は例外が伝播する", async () => {
    mockGenerateContent.mockRejectedValue(new Error("API rate limit exceeded"));

    await expect(
      analyzeEmailWithGemini("<html>test</html>", "key")
    ).rejects.toThrow("API rate limit exceeded");
  });
});
