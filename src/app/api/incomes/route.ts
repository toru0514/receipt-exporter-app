import { NextRequest, NextResponse } from "next/server";
import { getIncomes, createIncome, deleteIncome } from "@/lib/income-db";
import type { IncomeCreateInput } from "@/lib/income-types";

/** GET: 入金一覧取得（月別フィルタ対応） */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    const result = await getIncomes({
      year: year ? parseInt(year) : undefined,
      month: month ? parseInt(month) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("入金取得エラー:", error);
    return NextResponse.json(
      { error: "入金の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/** POST: 入金を新規作成 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as IncomeCreateInput;

    if (!body.date || !body.clientName || !body.amount) {
      return NextResponse.json(
        { error: "日付、客先、金額は必須です" },
        { status: 400 }
      );
    }

    const income = await createIncome(body);
    return NextResponse.json({ income }, { status: 201 });
  } catch (error) {
    console.error("入金登録エラー:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "入金の登録に失敗しました",
      },
      { status: 500 }
    );
  }
}

/** DELETE: 入金削除 */
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

    await deleteIncome(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("入金削除エラー:", error);
    return NextResponse.json(
      { error: "入金の削除に失敗しました" },
      { status: 500 }
    );
  }
}
