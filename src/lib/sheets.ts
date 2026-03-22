import { google } from "googleapis";
import { ParsedOrder } from "./types";
import { withRetry } from "./retry";

const SHEETS_RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  onRetry: (attempt: number, error: unknown, delayMs: number) => {
    console.warn(
      `[Sheets] リトライ ${attempt}/3 (${delayMs}ms後): ${error instanceof Error ? error.message : String(error)}`
    );
  },
};

export async function exportToSheet(
  accessToken: string,
  spreadsheetId: string,
  orders: ParsedOrder[]
): Promise<{ updatedRows: number }> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const sheets = google.sheets({ version: "v4", auth });

  // Check if header row exists, add if not
  const headerCheck = await withRetry(
    () =>
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Sheet1!A1:F1",
      }),
    SHEETS_RETRY_OPTIONS
  );

  if (!headerCheck.data.values || headerCheck.data.values.length === 0) {
    await withRetry(
      () =>
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "Sheet1!A1:F1",
          valueInputOption: "RAW",
          requestBody: {
            values: [
              [
                "注文日",
                "注文番号",
                "商品名",
                "金額",
                "消費税",
                "領収書リンク",
              ],
            ],
          },
        }),
      SHEETS_RETRY_OPTIONS
    );
  }

  const rows = orders.flatMap((order) =>
    order.items.map((item) => [
      order.orderDate,
      order.orderNumber,
      item.name,
      item.price,
      order.tax,
      order.receiptUrl ||
        `https://www.amazon.co.jp/gp/css/summary/print.html?orderID=${order.orderNumber}`,
    ])
  );

  if (rows.length === 0) return { updatedRows: 0 };

  const appendResult = await withRetry(
    () =>
      sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Sheet1!A:F",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      }),
    SHEETS_RETRY_OPTIONS
  );

  return {
    updatedRows: appendResult.data.updates?.updatedRows || 0,
  };
}

export async function createSpreadsheet(
  accessToken: string
): Promise<{ spreadsheetId: string; url: string }> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const sheets = google.sheets({ version: "v4", auth });

  const response = await withRetry(
    () =>
      sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: `Amazon経費管理_${new Date().toISOString().split("T")[0]}`,
          },
          sheets: [
            {
              properties: { title: "Sheet1" },
              data: [
                {
                  startRow: 0,
                  startColumn: 0,
                  rowData: [
                    {
                      values: [
                        "注文日",
                        "注文番号",
                        "商品名",
                        "金額",
                        "消費税",
                        "領収書リンク",
                      ].map((header) => ({
                        userEnteredValue: { stringValue: header },
                        userEnteredFormat: { textFormat: { bold: true } },
                      })),
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    SHEETS_RETRY_OPTIONS
  );

  return {
    spreadsheetId: response.data.spreadsheetId!,
    url: response.data.spreadsheetUrl!,
  };
}
