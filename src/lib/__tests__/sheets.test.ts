import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportToSheet, createSpreadsheet } from "../sheets";
import type { ParsedOrder } from "../types";

// Mock googleapis
const mockValuesGet = vi.fn();
const mockValuesUpdate = vi.fn();
const mockValuesAppend = vi.fn();
const mockSpreadsheetsCreate = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class MockOAuth2 {
        setCredentials = vi.fn();
      },
    },
    sheets: vi.fn(() => ({
      spreadsheets: {
        values: {
          get: mockValuesGet,
          update: mockValuesUpdate,
          append: mockValuesAppend,
        },
        create: mockSpreadsheetsCreate,
      },
    })),
  },
}));

const sampleOrders: ParsedOrder[] = [
  {
    orderDate: "2025-01-15",
    orderNumber: "250-1234567-7654321",
    items: [
      { name: "テスト商品A", quantity: 2, price: 1500 },
      { name: "テスト商品B", quantity: 1, price: 3000 },
    ],
    totalAmount: 6000,
    tax: 545,
    receiptUrl: "https://www.amazon.co.jp/receipt/123",
    source: "amazon",
  },
];

describe("exportToSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ヘッダーが存在しない場合はヘッダーを追加してデータを書き込む", async () => {
    mockValuesGet.mockResolvedValue({ data: { values: undefined } });
    mockValuesUpdate.mockResolvedValue({});
    mockValuesAppend.mockResolvedValue({
      data: { updates: { updatedRows: 2 } },
    });

    const result = await exportToSheet("token", "sheet-id", sampleOrders);

    expect(mockValuesUpdate).toHaveBeenCalledOnce();
    expect(mockValuesAppend).toHaveBeenCalledOnce();
    expect(result.updatedRows).toBe(2);

    // Verify header content includes ソース
    const updateCall = mockValuesUpdate.mock.calls[0][0];
    expect(updateCall.requestBody.values[0]).toContain("注文日");
    expect(updateCall.requestBody.values[0]).toContain("ソース");
    expect(updateCall.requestBody.values[0]).toContain("領収書リンク");
    expect(updateCall.range).toBe("Sheet1!A1:G1");
  });

  it("7列ヘッダーが既に存在する場合はヘッダー追加をスキップする", async () => {
    mockValuesGet.mockResolvedValue({
      data: { values: [["注文日", "注文番号", "商品名", "金額", "消費税", "ソース", "領収書リンク"]] },
    });
    mockValuesAppend.mockResolvedValue({
      data: { updates: { updatedRows: 2 } },
    });

    await exportToSheet("token", "sheet-id", sampleOrders);

    expect(mockValuesUpdate).not.toHaveBeenCalled();
    expect(mockValuesAppend).toHaveBeenCalledOnce();
  });

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

  it("注文の商品ごとに行が作成される（flatMap）", async () => {
    mockValuesGet.mockResolvedValue({ data: { values: [["header", "h", "h", "h", "h", "h", "h"]] } });
    mockValuesAppend.mockResolvedValue({
      data: { updates: { updatedRows: 2 } },
    });

    await exportToSheet("token", "sheet-id", sampleOrders);

    const appendCall = mockValuesAppend.mock.calls[0][0];
    const rows = appendCall.requestBody.values;

    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe("2025-01-15"); // orderDate
    expect(rows[0][1]).toBe("250-1234567-7654321"); // orderNumber
    expect(rows[0][2]).toBe("テスト商品A"); // item name
    expect(rows[0][3]).toBe(1500); // item price
    expect(rows[0][4]).toBe(545); // tax
    expect(rows[0][5]).toBe("Amazon"); // source
    expect(rows[0][6]).toBe("https://www.amazon.co.jp/receipt/123"); // receipt url
    expect(rows[1][2]).toBe("テスト商品B");
    expect(rows[1][5]).toBe("Amazon");
  });

  it("receiptUrlがない場合はAmazonのデフォルトURLを使用する", async () => {
    const ordersNoUrl: ParsedOrder[] = [
      {
        orderDate: "2025-01-01",
        orderNumber: "250-9999999-0000000",
        items: [{ name: "商品X", quantity: 1, price: 100 }],
        totalAmount: 100,
        tax: 10,
        receiptUrl: "",
        source: "amazon",
      },
    ];

    mockValuesGet.mockResolvedValue({ data: { values: [["h", "h", "h", "h", "h", "h", "h"]] } });
    mockValuesAppend.mockResolvedValue({
      data: { updates: { updatedRows: 1 } },
    });

    await exportToSheet("token", "sheet-id", ordersNoUrl);

    const rows = mockValuesAppend.mock.calls[0][0].requestBody.values;
    expect(rows[0][5]).toBe("Amazon");
    expect(rows[0][6]).toBe(
      "https://www.amazon.co.jp/gp/css/summary/print.html?orderID=250-9999999-0000000"
    );
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
      data: { values: [["h", "h", "h", "h", "h", "h", "h"]] },
    });
    mockValuesAppend.mockResolvedValue({
      data: { updates: { updatedRows: 1 } },
    });

    await exportToSheet("token", "sheet-id", rakutenOrders);

    const rows = mockValuesAppend.mock.calls[0][0].requestBody.values;
    expect(rows[0][5]).toBe("楽天");
    expect(rows[0][6]).toBe("https://order.my.rakuten.co.jp/");
  });

  it("注文リストが空の場合は0行を返しappendしない", async () => {
    mockValuesGet.mockResolvedValue({ data: { values: [["h", "h", "h", "h", "h", "h", "h"]] } });

    const emptyOrders: ParsedOrder[] = [];
    const result = await exportToSheet("token", "sheet-id", emptyOrders);

    expect(result.updatedRows).toBe(0);
    expect(mockValuesAppend).not.toHaveBeenCalled();
  });

  it("アイテムが空の注文の場合は行が生成されない", async () => {
    const orderNoItems: ParsedOrder[] = [
      {
        orderDate: "2025-01-01",
        orderNumber: "123",
        items: [],
        totalAmount: 0,
        tax: 0,
        receiptUrl: "",
        source: "amazon",
      },
    ];

    mockValuesGet.mockResolvedValue({ data: { values: [["h", "h", "h", "h", "h", "h", "h"]] } });

    const result = await exportToSheet("token", "sheet-id", orderNoItems);
    expect(result.updatedRows).toBe(0);
    expect(mockValuesAppend).not.toHaveBeenCalled();
  });

  it("updatedRowsがundefinedの場合は0を返す", async () => {
    mockValuesGet.mockResolvedValue({ data: { values: [["h", "h", "h", "h", "h", "h", "h"]] } });
    mockValuesAppend.mockResolvedValue({
      data: { updates: {} },
    });

    const result = await exportToSheet("token", "sheet-id", sampleOrders);
    expect(result.updatedRows).toBe(0);
  });

  it("Sheets APIエラーが伝播する", async () => {
    mockValuesGet.mockRejectedValue(new Error("Sheets API error"));

    await expect(
      exportToSheet("token", "sheet-id", sampleOrders)
    ).rejects.toThrow("Sheets API error");
  });
});

describe("createSpreadsheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("スプレッドシートを作成してIDとURLを返す", async () => {
    mockSpreadsheetsCreate.mockResolvedValue({
      data: {
        spreadsheetId: "new-sheet-id",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/new-sheet-id",
      },
    });

    const result = await createSpreadsheet("token");

    expect(result.spreadsheetId).toBe("new-sheet-id");
    expect(result.url).toBe("https://docs.google.com/spreadsheets/d/new-sheet-id");
  });

  it("作成リクエストにソース列を含むヘッダー行が含まれる", async () => {
    mockSpreadsheetsCreate.mockResolvedValue({
      data: {
        spreadsheetId: "id",
        spreadsheetUrl: "url",
      },
    });

    await createSpreadsheet("token");

    const createCall = mockSpreadsheetsCreate.mock.calls[0][0];
    const rowData =
      createCall.requestBody.sheets[0].data[0].rowData[0].values;

    const headerTexts = rowData.map(
      (v: { userEnteredValue: { stringValue: string } }) =>
        v.userEnteredValue.stringValue
    );
    expect(headerTexts).toContain("注文日");
    expect(headerTexts).toContain("注文番号");
    expect(headerTexts).toContain("商品名");
    expect(headerTexts).toContain("金額");
    expect(headerTexts).toContain("消費税");
    expect(headerTexts).toContain("ソース");
    expect(headerTexts).toContain("領収書リンク");
  });

  it("スプレッドシートタイトルがEC経費管理で始まる", async () => {
    mockSpreadsheetsCreate.mockResolvedValue({
      data: { spreadsheetId: "id", spreadsheetUrl: "url" },
    });

    await createSpreadsheet("token");

    const createCall = mockSpreadsheetsCreate.mock.calls[0][0];
    expect(createCall.requestBody.properties.title).toMatch(/^EC経費管理_/);
  });

  it("ヘッダーが太字フォーマットで設定される", async () => {
    mockSpreadsheetsCreate.mockResolvedValue({
      data: { spreadsheetId: "id", spreadsheetUrl: "url" },
    });

    await createSpreadsheet("token");

    const createCall = mockSpreadsheetsCreate.mock.calls[0][0];
    const firstHeader =
      createCall.requestBody.sheets[0].data[0].rowData[0].values[0];
    expect(firstHeader.userEnteredFormat.textFormat.bold).toBe(true);
  });

  it("Sheets APIエラーが伝播する", async () => {
    mockSpreadsheetsCreate.mockRejectedValue(new Error("Permission denied"));

    await expect(createSpreadsheet("token")).rejects.toThrow("Permission denied");
  });
});
