import { NextRequest, NextResponse } from "next/server";
import { getExpenses, createExpense, updateExpense, deleteExpense } from "@/lib/expense-db";
import type { ExpenseCreateInput } from "@/lib/expense-types";
import { validateYearMonth, validatePagination, validateAmount, validateDateString } from "@/lib/validation";

/** GET: 出金一覧取得（月別フィルタ対応） */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const search = searchParams.get("search");

    const ymResult = validateYearMonth(yearParam, monthParam);
    if (!ymResult.valid) {
      return NextResponse.json({ error: ymResult.error }, { status: 400 });
    }

    const pgResult = validatePagination(limitParam, offsetParam);
    if (!pgResult.valid) {
      return NextResponse.json({ error: pgResult.error }, { status: 400 });
    }

    const result = await getExpenses({
      year: ymResult.year,
      month: ymResult.month,
      limit: pgResult.limit,
      offset: pgResult.offset,
      search: search || undefined,
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

    const dateResult = validateDateString(body.date);
    if (!dateResult.valid) {
      return NextResponse.json({ error: dateResult.error }, { status: 400 });
    }

    const amountResult = validateAmount(body.amount);
    if (!amountResult.valid) {
      return NextResponse.json({ error: amountResult.error }, { status: 400 });
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

/** PATCH: 出金を更新 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...fields } = body as { id: string; [key: string]: unknown };

    if (!id) {
      return NextResponse.json(
        { error: "IDが必要です" },
        { status: 400 }
      );
    }

    // 日付が含まれる場合はバリデーション
    if (fields.date !== undefined) {
      const dateResult = validateDateString(fields.date);
      if (!dateResult.valid) {
        return NextResponse.json({ error: dateResult.error }, { status: 400 });
      }
    }

    // 金額が含まれる場合はバリデーション
    if (fields.amount !== undefined) {
      const amountResult = validateAmount(fields.amount);
      if (!amountResult.valid) {
        return NextResponse.json({ error: amountResult.error }, { status: 400 });
      }
    }

    const expense = await updateExpense(id, fields);
    return NextResponse.json({ expense });
  } catch (error) {
    console.error("出金更新エラー:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "出金の更新に失敗しました",
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
