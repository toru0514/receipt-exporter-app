import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportToSheet, createSpreadsheet } from "@/lib/sheets";
import { ParsedOrder } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";
import { validateOrders, validateSpreadsheetId } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { errorTracker } from "@/lib/error-tracker";
import { metrics } from "@/lib/metrics";
import { toAppError, errorToResponse } from "@/lib/errors";

const log = logger.child({ route: "/api/sheets" });

// Sheets API: 1分あたり5リクエストまで
const RATE_LIMIT_OPTIONS = { windowMs: 60_000, maxRequests: 5 };

export async function POST(request: NextRequest) {
  const endRequest = metrics.startRequest("/api/sheets");

  const session = await auth();
  if (!session?.accessToken) {
    log.warn("Unauthorized request");
    metrics.recordFailure("/api/sheets");
    endRequest();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // レート制限チェック
  const rateLimitKey = `sheets:${session.accessToken.slice(-16)}`;
  const rl = rateLimit(rateLimitKey, RATE_LIMIT_OPTIONS);
  if (!rl.allowed) {
    log.warn("Rate limit exceeded", { retryAfterMs: rl.retryAfterMs });
    metrics.recordFailure("/api/sheets");
    endRequest();
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
      log.warn("Invalid JSON body received");
      metrics.recordFailure("/api/sheets");
      endRequest();
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
      log.warn("Orders validation failed", { error: ordersValidation.error });
      metrics.recordFailure("/api/sheets");
      endRequest();
      return NextResponse.json(
        { error: ordersValidation.error },
        { status: 400 }
      );
    }

    // 入力値バリデーション: spreadsheetId
    const sheetIdValidation = validateSpreadsheetId(spreadsheetId);
    if (!sheetIdValidation.valid) {
      log.warn("SpreadsheetId validation failed", { error: sheetIdValidation.error });
      metrics.recordFailure("/api/sheets");
      endRequest();
      return NextResponse.json(
        { error: sheetIdValidation.error },
        { status: 400 }
      );
    }

    const validatedOrders = orders as ParsedOrder[];
    let targetSheetId = spreadsheetId as string | undefined;
    let sheetUrl: string | undefined;

    if (!targetSheetId) {
      log.info("Creating new spreadsheet");
      const created = await createSpreadsheet(session.accessToken);
      targetSheetId = created.spreadsheetId;
      sheetUrl = created.url;
    }

    log.info("Exporting orders to sheet", { orderCount: validatedOrders.length, spreadsheetId: targetSheetId });
    const result = await exportToSheet(
      session.accessToken,
      targetSheetId,
      validatedOrders
    );

    log.info("Export completed", { updatedRows: result.updatedRows });
    metrics.recordSuccess("/api/sheets");
    endRequest();
    return NextResponse.json({
      success: true,
      spreadsheetId: targetSheetId,
      url:
        sheetUrl ||
        `https://docs.google.com/spreadsheets/d/${targetSheetId}`,
      updatedRows: result.updatedRows,
    });
  } catch (error) {
    const appError = toAppError(error, "SHEETS_EXPORT_FAILED");
    console.error("Sheets API error:", error);
    log.error("Sheets export failed", {
      error: error instanceof Error ? error.message : String(error),
      errorCode: appError.code,
    });
    errorTracker.captureException(error, { module: "api/sheets" });
    metrics.recordFailure("/api/sheets");
    endRequest();
    const { body, status } = errorToResponse(appError);
    return NextResponse.json(body, { status });
  }
}
