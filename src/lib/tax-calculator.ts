/**
 * 消費税の計算ロジック
 *
 * 注文単位 / アイテム単位の税計算、
 * 軽減税率（8%）と標準税率（10%）の考慮、
 * 税額の整合性チェックを提供する。
 */

import { ParsedOrder, OrderItem } from "./types";

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

/** 標準税率 (10%) */
export const STANDARD_TAX_RATE = 0.10;

/** 軽減税率 (8%) — 食品・飲料（酒類を除く）、新聞 */
export const REDUCED_TAX_RATE = 0.08;

/** 税率の種別 */
export type TaxRateType = "standard" | "reduced";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export interface TaxBreakdown {
  /** 対象の税率種別 */
  rateType: TaxRateType;
  /** 適用税率 */
  rate: number;
  /** 課税対象の税抜金額 */
  taxableAmount: number;
  /** 算出した税額 */
  taxAmount: number;
}

export interface OrderTaxResult {
  /** 税率別の内訳 */
  breakdowns: TaxBreakdown[];
  /** 税額合計 */
  totalTax: number;
  /** 税込合計 */
  totalWithTax: number;
  /** 税抜合計 */
  totalWithoutTax: number;
}

export interface TaxConsistencyResult {
  /** 整合性があるか */
  consistent: boolean;
  /** 不一致の場合の差額 */
  discrepancy: number;
  /** 推定税率 */
  estimatedRate: number | null;
  /** 推定税率の種別（判別できた場合） */
  estimatedRateType: TaxRateType | null;
  /** 詳細メッセージ */
  message: string;
}

export interface ItemTaxDetail {
  /** 商品情報 */
  item: OrderItem;
  /** 適用税率種別 */
  rateType: TaxRateType;
  /** 適用税率 */
  rate: number;
  /** 税額（アイテム単位） */
  taxAmount: number;
  /** 税込金額 */
  priceWithTax: number;
}

// ---------------------------------------------------------------------------
// 税率判定
// ---------------------------------------------------------------------------

/**
 * 税率を取得する。
 */
function getTaxRate(rateType: TaxRateType): number {
  return rateType === "reduced" ? REDUCED_TAX_RATE : STANDARD_TAX_RATE;
}

// ---------------------------------------------------------------------------
// 注文単位の税計算
// ---------------------------------------------------------------------------

/**
 * 注文全体を単一の税率で計算する。
 *
 * @param subtotal - 税抜の商品合計金額
 * @param rateType - 適用する税率種別
 * @returns 税計算結果
 */
export function calculateOrderTax(
  subtotal: number,
  rateType: TaxRateType = "standard"
): OrderTaxResult {
  const rate = getTaxRate(rateType);
  const taxAmount = Math.floor(subtotal * rate);

  return {
    breakdowns: [
      {
        rateType,
        rate,
        taxableAmount: subtotal,
        taxAmount,
      },
    ],
    totalTax: taxAmount,
    totalWithTax: subtotal + taxAmount,
    totalWithoutTax: subtotal,
  };
}

/**
 * 複数の税率が混在する注文の税計算。
 *
 * @param standardSubtotal - 標準税率対象の税抜合計
 * @param reducedSubtotal - 軽減税率対象の税抜合計
 * @returns 税計算結果
 */
export function calculateMixedTaxOrder(
  standardSubtotal: number,
  reducedSubtotal: number
): OrderTaxResult {
  const standardTax = Math.floor(standardSubtotal * STANDARD_TAX_RATE);
  const reducedTax = Math.floor(reducedSubtotal * REDUCED_TAX_RATE);

  const breakdowns: TaxBreakdown[] = [];

  if (standardSubtotal > 0) {
    breakdowns.push({
      rateType: "standard",
      rate: STANDARD_TAX_RATE,
      taxableAmount: standardSubtotal,
      taxAmount: standardTax,
    });
  }

  if (reducedSubtotal > 0) {
    breakdowns.push({
      rateType: "reduced",
      rate: REDUCED_TAX_RATE,
      taxableAmount: reducedSubtotal,
      taxAmount: reducedTax,
    });
  }

  const totalTax = standardTax + reducedTax;
  const totalWithoutTax = standardSubtotal + reducedSubtotal;

  return {
    breakdowns,
    totalTax,
    totalWithTax: totalWithoutTax + totalTax,
    totalWithoutTax,
  };
}

// ---------------------------------------------------------------------------
// アイテム単位の税計算
// ---------------------------------------------------------------------------

/**
 * 各アイテムに対して個別に税計算を行う。
 *
 * @param items - 商品リスト
 * @param rateType - 全アイテムに適用する税率種別（デフォルト: standard）
 * @returns アイテムごとの税詳細
 */
export function calculateItemTax(
  items: OrderItem[],
  rateType: TaxRateType = "standard"
): ItemTaxDetail[] {
  const rate = getTaxRate(rateType);

  return items.map((item) => {
    const itemTotal = item.price * item.quantity;
    const taxAmount = Math.floor(itemTotal * rate);

    return {
      item,
      rateType,
      rate,
      taxAmount,
      priceWithTax: itemTotal + taxAmount,
    };
  });
}

/**
 * アイテムごとの税率マッピングを使って個別計算する。
 *
 * @param items - 商品リスト
 * @param rateMap - アイテムインデックス -> 税率種別のマップ
 * @returns アイテムごとの税詳細
 */
export function calculateItemTaxWithRateMap(
  items: OrderItem[],
  rateMap: Map<number, TaxRateType>
): ItemTaxDetail[] {
  return items.map((item, idx) => {
    const rateType = rateMap.get(idx) ?? "standard";
    const rate = getTaxRate(rateType);
    const itemTotal = item.price * item.quantity;
    const taxAmount = Math.floor(itemTotal * rate);

    return {
      item,
      rateType,
      rate,
      taxAmount,
      priceWithTax: itemTotal + taxAmount,
    };
  });
}

// ---------------------------------------------------------------------------
// 税額の整合性チェック
// ---------------------------------------------------------------------------

/**
 * ParsedOrder の税額と合計金額の整合性をチェックする。
 *
 * 以下のパターンを検証する:
 * 1. 合計金額が税込みの場合: totalAmount = subtotal + tax
 * 2. 合計金額が税抜きの場合: totalAmount = subtotal
 * 3. 税率が8%/10%として妥当か
 */
export function checkTaxConsistency(order: ParsedOrder): TaxConsistencyResult {
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // 商品データが無い場合はチェック不可
  if (subtotal === 0 || order.items.length === 0) {
    return {
      consistent: true,
      discrepancy: 0,
      estimatedRate: null,
      estimatedRateType: null,
      message: "商品データが不足しているため整合性チェックをスキップしました",
    };
  }

  // 税額 0 の場合
  if (order.tax === 0) {
    return {
      consistent: false,
      discrepancy: 0,
      estimatedRate: null,
      estimatedRateType: null,
      message: "税額が0円のため整合性を確認できません",
    };
  }

  // パターン1: totalAmount = subtotal + tax（tax 込みの合計）
  const pattern1Diff = Math.abs(order.totalAmount - (subtotal + order.tax));

  // パターン2: totalAmount = subtotal（tax が別）
  const pattern2Diff = Math.abs(order.totalAmount - subtotal);

  // 推定税率を計算
  let estimatedRate: number | null = null;
  let estimatedRateType: TaxRateType | null = null;

  if (subtotal > 0) {
    const rawRate = order.tax / subtotal;
    estimatedRate = Math.round(rawRate * 1000) / 1000;

    // 8% に近いか 10% に近いか判定
    const diffTo8 = Math.abs(rawRate - REDUCED_TAX_RATE);
    const diffTo10 = Math.abs(rawRate - STANDARD_TAX_RATE);

    if (diffTo8 < 0.015) {
      estimatedRateType = "reduced";
    } else if (diffTo10 < 0.015) {
      estimatedRateType = "standard";
    }
  }

  // 丸め誤差の許容（1円）
  const TOLERANCE = 1;

  if (pattern1Diff <= TOLERANCE) {
    return {
      consistent: true,
      discrepancy: 0,
      estimatedRate,
      estimatedRateType,
      message: "合計金額 = 商品合計 + 税額 で整合しています",
    };
  }

  if (pattern2Diff <= TOLERANCE) {
    // totalAmount が税抜きの合計金額
    return {
      consistent: true,
      discrepancy: 0,
      estimatedRate,
      estimatedRateType,
      message: "合計金額が税抜き金額と一致しています（税額は別計上）",
    };
  }

  // 不一致
  const minDiff = Math.min(pattern1Diff, pattern2Diff);
  return {
    consistent: false,
    discrepancy: minDiff,
    estimatedRate,
    estimatedRateType,
    message: `合計金額（${order.totalAmount.toLocaleString()}円）と商品合計（${subtotal.toLocaleString()}円）+ 税額（${order.tax.toLocaleString()}円）が一致しません（差額: ${minDiff.toLocaleString()}円）`,
  };
}

// ---------------------------------------------------------------------------
// 税額の逆算（合計金額から税額を推定）
// ---------------------------------------------------------------------------

/**
 * 税込金額から税額を逆算する。
 *
 * @param totalIncludingTax - 税込合計金額
 * @param rateType - 適用税率種別
 * @returns 推定税額（端数切り捨て）
 */
export function estimateTaxFromTotal(
  totalIncludingTax: number,
  rateType: TaxRateType = "standard"
): number {
  const rate = getTaxRate(rateType);
  // 税込金額 = 税抜金額 * (1 + rate)
  // 税抜金額 = 税込金額 / (1 + rate)
  // 税額 = 税込金額 - 税抜金額
  const taxExcluded = Math.ceil(totalIncludingTax / (1 + rate));
  return totalIncludingTax - taxExcluded;
}

/**
 * 税込金額に対して 8% / 10% 両方の推定税額を返す。
 * どちらの税率が適用されているか判断できない場合に使う。
 */
export function estimateTaxBothRates(totalIncludingTax: number): {
  standard: number;
  reduced: number;
} {
  return {
    standard: estimateTaxFromTotal(totalIncludingTax, "standard"),
    reduced: estimateTaxFromTotal(totalIncludingTax, "reduced"),
  };
}
