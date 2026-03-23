import { ParsedOrder, EmailSource } from "./types";

function getDefaultReceiptUrl(source: EmailSource, orderNumber: string): string {
  if (source === "rakuten") return "https://order.my.rakuten.co.jp/";
  return `https://www.amazon.co.jp/gp/css/summary/print.html?orderID=${orderNumber}`;
}

/**
 * CSV用にセル値をエスケープする
 * ダブルクォート・カンマ・改行を含む場合はダブルクォートで囲む
 */
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

/**
 * ParsedOrder[] を CSV 文字列に変換する（BOM 付き UTF-8 で日本語対応）
 */
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
    const receiptUrl = order.receiptUrl || getDefaultReceiptUrl(order.source, order.orderNumber);

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

/**
 * CSV文字列からBOM付きUTF-8のBlobを作成する
 */
export function createCsvBlob(csvString: string): Blob {
  const BOM = "\uFEFF";
  return new Blob([BOM + csvString], { type: "text/csv;charset=utf-8" });
}

/**
 * CSVをダウンロードさせる
 */
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
