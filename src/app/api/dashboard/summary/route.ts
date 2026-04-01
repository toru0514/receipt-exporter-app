import { NextRequest, NextResponse } from "next/server";
import { getReceipts } from "@/lib/receipt-db";
import { getIncomes } from "@/lib/income-db";
import { getSupabase } from "@/lib/supabase/db";

/** 出金合計を取得（テーブルが存在しない場合は0） */
async function getExpensesTotal(params: {
  year: number;
  month?: number;
}): Promise<{ total: number; count: number }> {
  try {
    const supabase = getSupabase();
    let startDate: string;
    let endDate: string;

    if (params.month) {
      startDate = `${params.year}-${String(params.month).padStart(2, "0")}-01`;
      const endMonth = params.month === 12 ? 1 : params.month + 1;
      const endYear = params.month === 12 ? params.year + 1 : params.year;
      endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    } else {
      startDate = `${params.year}-01-01`;
      endDate = `${params.year + 1}-01-01`;
    }

    const { data, count, error } = await supabase
      .from("expenses")
      .select("amount", { count: "exact" })
      .gte("date", startDate)
      .lt("date", endDate);

    if (error) return { total: 0, count: 0 };

    const total = (data ?? []).reduce(
      (sum: number, row: { amount: number }) => sum + (row.amount ?? 0),
      0
    );
    return { total, count: count ?? 0 };
  } catch {
    return { total: 0, count: 0 };
  }
}

/** GET: 年別または月別の収支サマリーを返す */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()));
    const monthParam = searchParams.get("month");
    const month = monthParam ? parseInt(monthParam) : undefined;

    // 並行で取得
    const queryParams = month ? { year, month } : { year };
    const [receiptsResult, incomesResult, expensesResult] = await Promise.all([
      getReceipts(queryParams).catch(() => ({
        receipts: [],
        totalCount: 0,
      })),
      getIncomes(queryParams).catch(() => ({
        incomes: [],
        totalCount: 0,
      })),
      getExpensesTotal(queryParams),
    ]);

    const receiptTotal = receiptsResult.receipts.reduce(
      (sum, r) => sum + r.totalAmount,
      0
    );
    const incomeTotal = incomesResult.incomes.reduce(
      (sum, i) => sum + i.amount,
      0
    );
    const expenseTotal = expensesResult.total;

    // 出金合計 = 領収書 + 出金管理
    const totalExpense = receiptTotal + expenseTotal;
    // 収支 = 入金 - 出金合計
    const balance = incomeTotal - totalExpense;

    return NextResponse.json({
      year,
      ...(month ? { month } : {}),
      income: {
        total: incomeTotal,
        count: incomesResult.totalCount,
      },
      expense: {
        receipt: {
          total: receiptTotal,
          count: receiptsResult.totalCount,
        },
        manual: {
          total: expenseTotal,
          count: expensesResult.count,
        },
        total: totalExpense,
      },
      balance,
    });
  } catch (error) {
    console.error("ダッシュボード取得エラー:", error);
    return NextResponse.json(
      { error: "収支情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}
