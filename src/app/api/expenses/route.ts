import { NextRequest, NextResponse } from "next/server";
import { getExpenses, createExpense, deleteExpense } from "@/lib/expense-db";
import type { ExpenseCreateInput } from "@/lib/expense-types";

/** GET: 出金一覧取得（月別フィルタ対応） */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    const result = await getExpenses({
      year: year ? parseInt(year) : undefined,
      month: month ? parseInt(month) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("出金取得エラー:", error);
    return NextResponse.json(
      { error: "出金の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/** POST: 出金を新規作成 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExpenseCreateInput;

    if (!body.date || !body.payeeName || !body.amount) {
      return NextResponse.json(
        { error: "日付、支払先、金額は必須です" },
        { status: 400 }
      );
    }

    const expense = await createExpense(body);
    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    console.error("出金登録エラー:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "出金の登録に失敗しました",
      },
      { status: 500 }
    );
  }
}

/** DELETE: 出金削除 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "IDが必要です" },
        { status: 400 }
      );
    }

    await deleteExpense(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("出金削除エラー:", error);
    return NextResponse.json(
      { error: "出金の削除に失敗しました" },
      { status: 500 }
    );
  }
}
