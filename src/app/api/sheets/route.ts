import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportToSheet, createSpreadsheet } from "@/lib/sheets";
import { ParsedOrder } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";
import { validateOrders, validateSpreadsheetId } from "@/lib/validation";

// Sheets API: 1分あたり5リクエストまで
const RATE_LIMIT_OPTIONS = { windowMs: 60_000, maxRequests: 5 };

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // レート制限チェック
  const rateLimitKey = `sheets:${session.accessToken.slice(-16)}`;
  const rl = rateLimit(rateLimitKey, RATE_LIMIT_OPTIONS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { orders, spreadsheetId } = body as {
      orders?: unknown;
      spreadsheetId?: unknown;
    };

    // 入力値バリデーション: orders
    const ordersValidation = validateOrders(orders);
    if (!ordersValidation.valid) {
      return NextResponse.json(
        { error: ordersValidation.error },
        { status: 400 }
      );
    }

    // 入力値バリデーション: spreadsheetId
    const sheetIdValidation = validateSpreadsheetId(spreadsheetId);
    if (!sheetIdValidation.valid) {
      return NextResponse.json(
        { error: sheetIdValidation.error },
        { status: 400 }
      );
    }

    const validatedOrders = orders as ParsedOrder[];
    let targetSheetId = spreadsheetId as string | undefined;
    let sheetUrl: string | undefined;

    if (!targetSheetId) {
      const created = await createSpreadsheet(session.accessToken);
      targetSheetId = created.spreadsheetId;
      sheetUrl = created.url;
    }

    const result = await exportToSheet(
      session.accessToken,
      targetSheetId,
      validatedOrders
    );

    return NextResponse.json({
      success: true,
      spreadsheetId: targetSheetId,
      url:
        sheetUrl ||
        `https://docs.google.com/spreadsheets/d/${targetSheetId}`,
      updatedRows: result.updatedRows,
    });
  } catch (error) {
    console.error("Sheets API error:", error);
    return NextResponse.json(
      { error: "Failed to export to sheet" },
      { status: 500 }
    );
  }
}
