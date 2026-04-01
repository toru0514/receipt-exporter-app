import { NextRequest, NextResponse } from "next/server";
import { getReceipts } from "@/lib/receipt-db";
import { getIncomes } from "@/lib/income-db";
import { getExpenses } from "@/lib/expense-db";
import type { ReceiptSource } from "@/lib/receipt-types";

function escapeCsvCell(value: string): string {
  // CSVインジェクション対策: 先頭が危険文字の場合にシングルクォートを付与
  if (/^[=+\-@\t\r]/.test(value)) {
    value = "'" + value;
  }
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

interface CsvRow {
  date: string;
  type: string; // 入金 / 出金
  source: string; // クライアント名 / 支払先 / EC店舗名
  description: string;
  income: string; // 入金額（出金時は空）
  expense: string; // 出金額（入金時は空）
  category: string;
  notes: string;
}

/** GET: 収支全体CSVダウンロード */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    if (!year) {
      return NextResponse.json(
        { error: "年を指定してください" },
        { status: 400 }
      );
    }

    const queryParams = {
      year: parseInt(year),
      month: month ? parseInt(month) : undefined,
      limit: 500,
    };

    const [receiptsResult, incomesResult, expensesResult] = await Promise.all([
      getReceipts(queryParams).catch(() => ({ receipts: [], totalCount: 0 })),
      getIncomes(queryParams).catch(() => ({ incomes: [], totalCount: 0 })),
      getExpenses(queryParams).catch(() => ({ expenses: [], totalCount: 0 })),
    ]);

    const rows: CsvRow[] = [];

    // 入金データ
    for (const income of incomesResult.incomes) {
      rows.push({
        date: income.date,
        type: "入金",
        source: income.clientName,
        description: income.description,
        income: String(income.amount),
        expense: "",
        category: "",
        notes: income.notes,
      });
    }

    // 領収書/EC出金データ
    for (const receipt of receiptsResult.receipts) {
      const itemNames = receipt.items.map((i) => i.name).join(" / ");
      rows.push({
        date: receipt.date,
        type: "出金",
        source: `${sourceLabel(receipt.source)} - ${receipt.storeName}`,
        description: itemNames || receipt.memo,
        income: "",
        expense: String(receipt.totalAmount),
        category: receipt.category,
        notes: receipt.orderNumber ? `注文番号: ${receipt.orderNumber}` : "",
      });
    }

    // 手動出金データ
    for (const expense of expensesResult.expenses) {
      rows.push({
        date: expense.date,
        type: "出金",
        source: expense.payeeName,
        description: expense.description,
        income: "",
        expense: String(expense.amount),
        category: expense.category,
        notes: expense.notes,
      });
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "該当するデータがありません" },
        { status: 404 }
      );
    }

    // 日付順にソート
    rows.sort((a, b) => a.date.localeCompare(b.date));

    const headers = [
      "日付",
      "種別",
      "取引先",
      "説明",
      "入金額",
      "出金額",
      "カテゴリ",
      "備考",
    ];

    const headerLine = headers.map(escapeCsvCell).join(",");
    const dataLines = rows.map((row) =>
      [
        row.date,
        row.type,
        row.source,
        row.description,
        row.income,
        row.expense,
        row.category,
        row.notes,
      ]
        .map(escapeCsvCell)
        .join(",")
    );

    const csv = headerLine + "\n" + dataLines.join("\n");
    const BOM = "\uFEFF";
    const label = month
      ? `financial_summary_${year}_${String(month).padStart(2, "0")}`
      : `financial_summary_${year}`;

    return new NextResponse(BOM + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${label}.csv"`,
      },
    });
  } catch (error) {
    console.error("収支CSVエクスポートエラー:", error);
    return NextResponse.json(
      { error: "CSVエクスポートに失敗しました" },
      { status: 500 }
    );
  }
}
