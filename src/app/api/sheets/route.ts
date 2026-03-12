import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportToSheet, createSpreadsheet } from "@/lib/sheets";
import { ParsedOrder } from "@/lib/types";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orders, spreadsheetId } = (await request.json()) as {
      orders: ParsedOrder[];
      spreadsheetId?: string;
    };

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: "No orders to export" },
        { status: 400 }
      );
    }

    let targetSheetId = spreadsheetId;
    let sheetUrl: string | undefined;

    if (!targetSheetId) {
      const created = await createSpreadsheet(session.accessToken);
      targetSheetId = created.spreadsheetId;
      sheetUrl = created.url;
    }

    const result = await exportToSheet(
      session.accessToken,
      targetSheetId,
      orders
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
