import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDistinctPayees } from "@/lib/expense-db";

/** GET: 過去の支払先名一覧（コンボボックス用） */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payees = await getDistinctPayees();
    return NextResponse.json({ payees });
  } catch (error) {
    console.error("支払先一覧取得エラー:", error);
    return NextResponse.json(
      { error: "支払先一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
