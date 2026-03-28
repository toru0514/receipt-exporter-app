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
