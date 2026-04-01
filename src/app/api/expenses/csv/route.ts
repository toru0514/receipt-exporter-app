import { NextRequest, NextResponse } from "next/server";
import { getExpenses } from "@/lib/expense-db";
import type { Expense } from "@/lib/expense-types";

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

function expensesToCSV(expenses: Expense[]): string {
  const headers = ["日付", "支払先", "説明", "金額", "メモ"];

  const rows: string[][] = expenses.map((expense) => [
    expense.date,
    expense.payeeName,
    expense.description,
    String(expense.amount),
    expense.notes,
  ]);

  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(","));
  return headerLine + "\n" + dataLines.join("\n");
}

/** GET: 出金CSVダウンロード */
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

    const { expenses } = await getExpenses({
      year: parseInt(year),
      month: month ? parseInt(month) : undefined,
      limit: 500,
    });

    if (expenses.length === 0) {
      return NextResponse.json(
        { error: "該当するデータがありません" },
        { status: 404 }
      );
    }

    const csv = expensesToCSV(expenses);
    const BOM = "\uFEFF";
    const label = month
      ? `expenses_${year}_${String(month).padStart(2, "0")}`
      : `expenses_${year}`;

    return new NextResponse(BOM + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${label}.csv"`,
      },
    });
  } catch (error) {
    console.error("出金CSVエクスポートエラー:", error);
    return NextResponse.json(
      { error: "CSVエクスポートに失敗しました" },
      { status: 500 }
    );
  }
}
