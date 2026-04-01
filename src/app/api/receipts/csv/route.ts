import { NextRequest, NextResponse } from "next/server";
import { getReceipts } from "@/lib/receipt-db";
import type { Receipt, ReceiptSource } from "@/lib/receipt-types";

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

function sourceLabel(source: ReceiptSource): string {
  switch (source) {
    case "amazon":
      return "Amazon";
    case "rakuten":
      return "楽天市場";
    case "photo":
      return "写真";
  }
}

function receiptsToCSV(receipts: Receipt[]): string {
  const headers = [
    "日付",
    "ソース",
    "店舗名",
    "注文番号",
    "商品名",
    "数量",
    "金額",
    "消費税",
    "合計金額",
    "支払方法",
    "カテゴリ",
    "領収書リンク",
  ];

  const rows: string[][] = [];

  for (const receipt of receipts) {
    if (receipt.items.length > 0) {
      for (const item of receipt.items) {
        rows.push([
          receipt.date,
          sourceLabel(receipt.source),
          receipt.storeName,
          receipt.orderNumber,
          item.name,
          String(item.quantity),
          String(item.price),
          String(receipt.tax),
          String(receipt.totalAmount),
          receipt.paymentMethod,
          receipt.category,
          receipt.receiptUrl || receipt.imageUrl,
        ]);
      }
    } else {
      rows.push([
        receipt.date,
        sourceLabel(receipt.source),
        receipt.storeName,
        receipt.orderNumber,
        "",
        "",
        "",
        String(receipt.tax),
        String(receipt.totalAmount),
        receipt.paymentMethod,
        receipt.category,
        receipt.receiptUrl || receipt.imageUrl,
      ]);
    }
  }

  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(","));
  return headerLine + "\n" + dataLines.join("\n");
}

/** GET: 統合CSVダウンロード */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const source = searchParams.get("source") as ReceiptSource | null;

    if (!year) {
      return NextResponse.json(
        { error: "年を指定してください" },
        { status: 400 }
      );
    }

    const { receipts } = await getReceipts({
      year: parseInt(year),
      month: month ? parseInt(month) : undefined,
      source: source ?? undefined,
      limit: 500,
    });

    if (receipts.length === 0) {
      return NextResponse.json(
        { error: "該当するデータがありません" },
        { status: 404 }
      );
    }

    const csv = receiptsToCSV(receipts);
    const BOM = "\uFEFF";
    const label = month
      ? `receipts_${year}_${String(month).padStart(2, "0")}`
      : `receipts_${year}`;

    return new NextResponse(BOM + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${label}.csv"`,
      },
    });
  } catch (error) {
    console.error("CSVエクスポートエラー:", error);
    return NextResponse.json(
      { error: "CSVエクスポートに失敗しました" },
      { status: 500 }
    );
  }
}
