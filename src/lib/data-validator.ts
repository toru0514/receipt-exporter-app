/**
 * AI抽出データのバリデーション
 *
 * Gemini が抽出した ParsedOrder の各フィールドを検証し、
 * フィールドごとに warnings / errors を返す。
 */

import { ParsedOrder, OrderItem } from "./types";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type Severity = "error" | "warning";

export interface FieldIssue {
  field: string;
  severity: Severity;
  message: string;
}

export interface ValidationReport {
  /** フィールド単位の問題一覧 */
  issues: FieldIssue[];
  /** error が 1 件でもあれば false */
  valid: boolean;
  /** warning のみなら true（error が無い） */
  hasWarnings: boolean;
}

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

/** Amazon 注文番号の正規表現（例: 250-1234567-1234567） */
const ORDER_NUMBER_REGEX = /^\d{3}-\d{7}-\d{7}$/;

/** 日付形式: YYYY/MM/DD or YYYY-MM-DD */
const DATE_REGEX = /^\d{4}[-/]\d{2}[-/]\d{2}$/;

/** 金額の合理的な上限（100 万円） */
const MAX_REASONABLE_AMOUNT = 1_000_000;

/** 金額の合理的な上限（警告のみ、10 万円超） */
const WARN_AMOUNT_THRESHOLD = 100_000;

/** 単品の合理的な上限（50 万円） */
const MAX_ITEM_PRICE = 500_000;

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function isValidDate(dateStr: string): boolean {
  const normalized = dateStr.replace(/\//g, "-");
  const parts = normalized.split("-");
  if (parts.length !== 3) return false;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Date で実在日かチェック
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

function isFutureDate(dateStr: string): boolean {
  const normalized = dateStr.replace(/\//g, "-");
  const d = new Date(normalized);
  return d.getTime() > Date.now();
}

// ---------------------------------------------------------------------------
// 個別フィールドバリデーション
// ---------------------------------------------------------------------------

function validateOrderDate(date: string): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (!date || date.trim() === "") {
    issues.push({
      field: "orderDate",
      severity: "error",
      message: "注文日が空です",
    });
    return issues;
  }

  if (!DATE_REGEX.test(date)) {
    issues.push({
      field: "orderDate",
      severity: "error",
      message: "日付形式が不正です（YYYY-MM-DD または YYYY/MM/DD）",
    });
    return issues;
  }

  if (!isValidDate(date)) {
    issues.push({
      field: "orderDate",
      severity: "error",
      message: "存在しない日付です",
    });
    return issues;
  }

  if (isFutureDate(date)) {
    issues.push({
      field: "orderDate",
      severity: "warning",
      message: "未来の日付です",
    });
  }

  return issues;
}

function validateOrderNumber(orderNumber: string): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (!orderNumber || orderNumber.trim() === "") {
    issues.push({
      field: "orderNumber",
      severity: "error",
      message: "注文番号が空です",
    });
    return issues;
  }

  if (!ORDER_NUMBER_REGEX.test(orderNumber)) {
    issues.push({
      field: "orderNumber",
      severity: "warning",
      message:
        "注文番号のフォーマットが標準的ではありません（期待: XXX-XXXXXXX-XXXXXXX）",
    });
  }

  return issues;
}

function validateAmount(
  amount: number,
  field: string,
  label: string
): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (typeof amount !== "number" || isNaN(amount)) {
    issues.push({
      field,
      severity: "error",
      message: `${label}が数値ではありません`,
    });
    return issues;
  }

  if (amount < 0) {
    issues.push({
      field,
      severity: "error",
      message: `${label}が負の値です`,
    });
  }

  if (amount > MAX_REASONABLE_AMOUNT) {
    issues.push({
      field,
      severity: "error",
      message: `${label}が上限（${MAX_REASONABLE_AMOUNT.toLocaleString()}円）を超えています`,
    });
  } else if (amount > WARN_AMOUNT_THRESHOLD) {
    issues.push({
      field,
      severity: "warning",
      message: `${label}が高額です（${amount.toLocaleString()}円）。内容を確認してください`,
    });
  }

  if (!Number.isInteger(amount)) {
    issues.push({
      field,
      severity: "warning",
      message: `${label}が整数ではありません（${amount}）`,
    });
  }

  return issues;
}

function validateTax(tax: number, totalAmount: number): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (typeof tax !== "number" || isNaN(tax)) {
    issues.push({
      field: "tax",
      severity: "error",
      message: "消費税が数値ではありません",
    });
    return issues;
  }

  if (tax < 0) {
    issues.push({
      field: "tax",
      severity: "error",
      message: "消費税が負の値です",
    });
    return issues;
  }

  if (totalAmount > 0 && tax > totalAmount) {
    issues.push({
      field: "tax",
      severity: "error",
      message: "消費税が合計金額を超えています",
    });
  }

  // 税額 0 で合計金額が正の場合は警告
  if (tax === 0 && totalAmount > 0) {
    issues.push({
      field: "tax",
      severity: "warning",
      message: "消費税が0円です。抽出できなかった可能性があります",
    });
  }

  // 税率の妥当性チェック（合計金額に対して 7-11% の範囲外なら警告）
  if (totalAmount > 0 && tax > 0) {
    const taxRate = tax / totalAmount;
    if (taxRate < 0.06 || taxRate > 0.12) {
      issues.push({
        field: "tax",
        severity: "warning",
        message: `税額の割合（${(taxRate * 100).toFixed(1)}%）が通常範囲外です`,
      });
    }
  }

  return issues;
}

function validateItems(items: OrderItem[]): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (!Array.isArray(items) || items.length === 0) {
    issues.push({
      field: "items",
      severity: "error",
      message: "商品が0件です",
    });
    return issues;
  }

  items.forEach((item, idx) => {
    const prefix = `items[${idx}]`;

    if (!item.name || item.name.trim() === "") {
      issues.push({
        field: `${prefix}.name`,
        severity: "error",
        message: `商品${idx + 1}の名前が空です`,
      });
    }

    if (typeof item.quantity !== "number" || item.quantity < 1) {
      issues.push({
        field: `${prefix}.quantity`,
        severity: "error",
        message: `商品${idx + 1}の数量が不正です`,
      });
    }

    if (typeof item.price !== "number" || item.price < 0) {
      issues.push({
        field: `${prefix}.price`,
        severity: "error",
        message: `商品${idx + 1}の価格が不正です`,
      });
    } else if (item.price === 0) {
      issues.push({
        field: `${prefix}.price`,
        severity: "warning",
        message: `商品${idx + 1}の価格が0円です`,
      });
    } else if (item.price > MAX_ITEM_PRICE) {
      issues.push({
        field: `${prefix}.price`,
        severity: "warning",
        message: `商品${idx + 1}の価格が高額です（${item.price.toLocaleString()}円）`,
      });
    }
  });

  return issues;
}

function validateTotalConsistency(order: ParsedOrder): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (order.items.length === 0 || order.totalAmount === 0) return issues;

  const itemsSum = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // アイテム合計と totalAmount の比較（税込みの場合もあるので差が大きい場合のみ警告）
  if (itemsSum > 0 && order.totalAmount > 0) {
    const diff = Math.abs(order.totalAmount - itemsSum);
    // 差が税額と大きく異なる場合に警告
    if (order.tax > 0 && diff > 0) {
      const expectedWithTax = itemsSum + order.tax;
      const discrepancy = Math.abs(order.totalAmount - expectedWithTax);
      if (discrepancy > 1 && Math.abs(order.totalAmount - itemsSum) > 1) {
        // 合計 = 商品合計 でも 合計 = 商品合計+税 でもない
        issues.push({
          field: "totalAmount",
          severity: "warning",
          message: `合計金額（${order.totalAmount.toLocaleString()}円）が商品合計（${itemsSum.toLocaleString()}円）+ 税（${order.tax.toLocaleString()}円）= ${expectedWithTax.toLocaleString()}円と一致しません`,
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// メインバリデーション関数
// ---------------------------------------------------------------------------

/**
 * ParsedOrder を総合的にバリデーションし、フィールドごとの問題一覧を返す。
 */
export function validateParsedOrder(order: ParsedOrder): ValidationReport {
  const issues: FieldIssue[] = [
    ...validateOrderDate(order.orderDate),
    ...validateOrderNumber(order.orderNumber),
    ...validateAmount(order.totalAmount, "totalAmount", "合計金額"),
    ...validateTax(order.tax, order.totalAmount),
    ...validateItems(order.items),
    ...validateTotalConsistency(order),
  ];

  const hasErrors = issues.some((i) => i.severity === "error");
  const hasWarnings = issues.some((i) => i.severity === "warning");

  return {
    issues,
    valid: !hasErrors,
    hasWarnings,
  };
}

/**
 * 特定フィールドに関する問題のみをフィルタして返す。
 */
export function getIssuesForField(
  report: ValidationReport,
  field: string
): FieldIssue[] {
  return report.issues.filter(
    (i) => i.field === field || i.field.startsWith(`${field}.`) || i.field.startsWith(`${field}[`)
  );
}
