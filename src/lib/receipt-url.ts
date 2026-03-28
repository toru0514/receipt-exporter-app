import type { EmailSource } from "./types";

/**
 * ソースと注文番号からデフォルトの領収書URLを生成する。
 * クライアント/サーバー両方で使える軽量ユーティリティ。
 */
export function getDefaultReceiptUrl(source: EmailSource, orderNumber: string): string {
  if (source === "rakuten") return "https://order.my.rakuten.co.jp/";
  return `https://www.amazon.co.jp/gp/your-account/order-details?orderID=${orderNumber}`;
}
