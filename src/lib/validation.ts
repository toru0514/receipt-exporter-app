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
