import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/db";

interface MonthlyRow {
  month: number;
  income: number;
  incomeCount: number;
  receiptExpense: number;
  receiptCount: number;
  manualExpense: number;
  manualCount: number;
}

/** GET: 年内の月別収支タイムラインを返す */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(
      searchParams.get("year") ?? String(now.getFullYear())
    );

    const startDate = `${year}-01-01`;
    const endDate = `${year + 1}-01-01`;

    const supabase = getSupabase();

    const [incomesRes, receiptsRes, expensesRes] = await Promise.all([
      supabase
        .from("incomes")
        .select("date, amount")
        .gte("date", startDate)
        .lt("date", endDate),
      supabase
        .from("receipts")
        .select("date, total_amount")
        .gte("date", startDate)
        .lt("date", endDate),
      supabase
        .from("expenses")
        .select("date, amount")
        .gte("date", startDate)
        .lt("date", endDate),
    ]);

    // 月別に集計
    const months: MonthlyRow[] = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: 0,
      incomeCount: 0,
      receiptExpense: 0,
      receiptCount: 0,
      manualExpense: 0,
      manualCount: 0,
    }));

    for (const row of incomesRes.data ?? []) {
      const m = new Date(row.date).getMonth();
      months[m].income += row.amount ?? 0;
      months[m].incomeCount++;
    }

    for (const row of receiptsRes.data ?? []) {
      const m = new Date(row.date).getMonth();
      months[m].receiptExpense += row.total_amount ?? 0;
      months[m].receiptCount++;
    }

    for (const row of expensesRes.data ?? []) {
      const m = new Date(row.date).getMonth();
      months[m].manualExpense += row.amount ?? 0;
      months[m].manualCount++;
    }

    const timeline = months.map((m) => ({
      month: m.month,
      income: m.income,
      incomeCount: m.incomeCount,
      expense: m.receiptExpense + m.manualExpense,
      expenseCount: m.receiptCount + m.manualCount,
      balance: m.income - (m.receiptExpense + m.manualExpense),
    }));

    return NextResponse.json({ year, timeline });
  } catch (error) {
    console.error("タイムライン取得エラー:", error);
    return NextResponse.json(
      { error: "タイムラインの取得に失敗しました" },
      { status: 500 }
    );
  }
}
