/**
 * 入力値バリデーション ユーティリティ
 */

import { ParsedOrder, OrderItem } from "./types";

/** emailHtml の最大サイズ（バイト） */
const MAX_EMAIL_HTML_SIZE = 50 * 1024; // 50KB

/** orders 配列の最大件数 */
const MAX_ORDERS_COUNT = 100;

/** 1 注文あたりの items の最大件数 */
const MAX_ITEMS_PER_ORDER = 50;

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * /api/analyze 用: emailHtml のバリデーション
 */
export function validateEmailHtml(emailHtml: unknown): ValidationResult {
  if (typeof emailHtml !== "string") {
    return { valid: false, error: "emailHtml must be a string" };
  }

  const byteLength = Buffer.byteLength(emailHtml, "utf-8");
  if (byteLength > MAX_EMAIL_HTML_SIZE) {
    return {
      valid: false,
      error: `emailHtml exceeds maximum size of ${MAX_EMAIL_HTML_SIZE} bytes (received ${byteLength} bytes)`,
    };
  }

  if (emailHtml.trim().length === 0) {
    return { valid: false, error: "emailHtml must not be empty" };
  }

  return { valid: true };
}

/**
 * OrderItem が正しい型かどうかチェック
 */
function isValidOrderItem(item: unknown): item is OrderItem {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    typeof obj.quantity === "number" &&
    typeof obj.price === "number"
  );
}

/**
 * ParsedOrder が正しい型かどうかチェック
 */
function isValidParsedOrder(order: unknown): order is ParsedOrder {
  if (typeof order !== "object" || order === null) return false;
  const obj = order as Record<string, unknown>;
  return (
    typeof obj.orderDate === "string" &&
    typeof obj.orderNumber === "string" &&
    Array.isArray(obj.items) &&
    typeof obj.totalAmount === "number" &&
    typeof obj.tax === "number" &&
    typeof obj.receiptUrl === "string"
  );
}

/**
 * /api/sheets 用: orders 配列のバリデーション
 */
export function validateOrders(orders: unknown): ValidationResult {
  if (!Array.isArray(orders)) {
    return { valid: false, error: "orders must be an array" };
  }

  if (orders.length === 0) {
    return { valid: false, error: "orders must not be empty" };
  }

  if (orders.length > MAX_ORDERS_COUNT) {
    return {
      valid: false,
      error: `orders exceeds maximum count of ${MAX_ORDERS_COUNT} (received ${orders.length})`,
    };
  }

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    if (!isValidParsedOrder(order)) {
      return {
        valid: false,
        error: `orders[${i}] has invalid structure: requires orderDate(string), orderNumber(string), items(array), totalAmount(number), tax(number), receiptUrl(string)`,
      };
    }

    if (order.items.length > MAX_ITEMS_PER_ORDER) {
      return {
        valid: false,
        error: `orders[${i}].items exceeds maximum count of ${MAX_ITEMS_PER_ORDER}`,
      };
    }

    for (let j = 0; j < order.items.length; j++) {
      if (!isValidOrderItem(order.items[j])) {
        return {
          valid: false,
          error: `orders[${i}].items[${j}] has invalid structure: requires name(string), quantity(number), price(number)`,
        };
      }
    }
  }

  return { valid: true };
}

// ─── 共通バリデーション関数 ───

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * year/month クエリパラメータのバリデーション
 */
export function validateYearMonth(
  year: string | null,
  month: string | null
): ValidationResult & { year?: number; month?: number } {
  let parsedYear: number | undefined;
  let parsedMonth: number | undefined;

  if (year !== null) {
    parsedYear = parseInt(year);
    if (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > 2100) {
      return { valid: false, error: "yearは1900〜2100の整数で指定してください" };
    }
  }

  if (month !== null) {
    parsedMonth = parseInt(month);
    if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      return { valid: false, error: "monthは1〜12の整数で指定してください" };
    }
  }

  return { valid: true, year: parsedYear, month: parsedMonth };
}

/**
 * limit/offset クエリパラメータのバリデーション
 */
export function validatePagination(
  limit: string | null,
  offset: string | null
): ValidationResult & { limit?: number; offset?: number } {
  let parsedLimit: number | undefined;
  let parsedOffset: number | undefined;

  if (limit !== null) {
    parsedLimit = parseInt(limit);
    if (isNaN(parsedLimit) || parsedLimit < 0) {
      return { valid: false, error: "limitは0以上の整数で指定してください" };
    }
  }

  if (offset !== null) {
    parsedOffset = parseInt(offset);
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return { valid: false, error: "offsetは0以上の整数で指定してください" };
    }
  }

  return { valid: true, limit: parsedLimit, offset: parsedOffset };
}

/**
 * 日付文字列(YYYY-MM-DD)のバリデーション
 */
export function validateDateString(date: unknown): ValidationResult {
  if (typeof date !== "string" || !DATE_REGEX.test(date)) {
    return { valid: false, error: "日付はYYYY-MM-DD形式で指定してください" };
  }
  // 実在する日付かチェック
  const d = new Date(date + "T00:00:00");
  if (isNaN(d.getTime())) {
    return { valid: false, error: "無効な日付です" };
  }
  return { valid: true };
}

/**
 * 金額(0以上の整数)のバリデーション
 */
export function validateAmount(amount: unknown, fieldName: string = "金額"): ValidationResult {
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0) {
    return { valid: false, error: `${fieldName}は0以上の整数で指定してください` };
  }
  return { valid: true };
}

/**
 * /api/sheets 用: spreadsheetId のバリデーション
 */
export function validateSpreadsheetId(id: unknown): ValidationResult {
  if (id === undefined || id === null) {
    // spreadsheetId は任意なので未指定は OK
    return { valid: true };
  }

  if (typeof id !== "string") {
    return { valid: false, error: "spreadsheetId must be a string" };
  }

  // Google Sheets ID は英数字、ハイフン、アンダースコアで構成される
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return { valid: false, error: "spreadsheetId contains invalid characters" };
  }

  return { valid: true };
}
