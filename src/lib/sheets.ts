import { google } from "googleapis";
import { ParsedOrder } from "./types";
import { withRetry } from "./retry";
import { getProvider } from "./providers";

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

const HEADERS = ["注文日", "注文番号", "商品名", "金額", "消費税", "ソース", "領収書リンク"];

export async function exportToSheet(
  accessToken: string,
  spreadsheetId: string,
  orders: ParsedOrder[]
): Promise<{ updatedRows: number }> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const sheets = google.sheets({ version: "v4", auth });

  // ヘッダー行チェック
  const headerCheck = await withRetry(
    () =>
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Sheet1!A1:G1",
      }),
    SHEETS_RETRY_OPTIONS
  );

  const existingHeaders = headerCheck.data.values?.[0];
  if (!existingHeaders || existingHeaders.length === 0) {
    // ヘッダーなし → 新規作成
    await withRetry(
      () =>
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "Sheet1!A1:G1",
          valueInputOption: "RAW",
          requestBody: { values: [HEADERS] },
        }),
      SHEETS_RETRY_OPTIONS
    );
  } else if (existingHeaders.length <= 6 && !existingHeaders.includes("ソース")) {
    // 旧6列ヘッダー → 7列に更新
    await withRetry(
      () =>
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "Sheet1!A1:G1",
          valueInputOption: "RAW",
          requestBody: { values: [HEADERS] },
        }),
      SHEETS_RETRY_OPTIONS
    );
  }

  const rows = orders.flatMap((order) => {
    const sourceLabel = order.source === "amazon" ? "Amazon" : "楽天";
    const receiptUrl = order.receiptUrl || getProvider(order.source).getDefaultReceiptUrl(order.orderNumber);

    return order.items.map((item) => [
      order.orderDate,
      order.orderNumber,
      item.name,
      item.price,
      order.tax,
      sourceLabel,
      receiptUrl,
    ]);
  });

  if (rows.length === 0) return { updatedRows: 0 };

  const appendResult = await withRetry(
    () =>
      sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Sheet1!A:G",
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
            title: `EC経費管理_${new Date().toISOString().split("T")[0]}`,
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
                      values: HEADERS.map((header) => ({
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
