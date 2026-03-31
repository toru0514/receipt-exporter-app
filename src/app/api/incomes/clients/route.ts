import { NextResponse } from "next/server";
import { getDistinctClients } from "@/lib/income-db";

/** GET: 過去の客先名一覧（コンボボックス用） */
export async function GET() {
  try {
    const clients = await getDistinctClients();
    return NextResponse.json({ clients });
  } catch (error) {
    console.error("客先一覧取得エラー:", error);
    return NextResponse.json(
      { error: "客先一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
