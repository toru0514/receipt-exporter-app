import { NextRequest, NextResponse } from "next/server";
import {
  findReceiptByOrderNumber,
  createReceiptFromOrder,
} from "@/lib/receipt-db";
import type { ParsedOrder } from "@/lib/types";

/** POST: 解析済み注文をSupabaseに一括保存（重複スキップ） */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orders } = body as { orders: ParsedOrder[] };

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { error: "注文データが必要です" },
        { status: 400 }
      );
    }

    let saved = 0;
    let skipped = 0;
    let errors = 0;

    for (const order of orders) {
      try {
        const existing = await findReceiptByOrderNumber(order.orderNumber);
        if (existing) {
          skipped++;
          continue;
        }
        await createReceiptFromOrder(order);
        saved++;
      } catch (err) {
        console.error(`注文保存エラー (${order.orderNumber}):`, err);
        errors++;
      }
    }

    return NextResponse.json({ saved, skipped, errors });
  } catch (error) {
    console.error("注文一括保存エラー:", error);
    return NextResponse.json(
      { error: "注文の保存に失敗しました" },
      { status: 500 }
    );
  }
}
