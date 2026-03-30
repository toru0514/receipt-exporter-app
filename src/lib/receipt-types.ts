export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

export type ReceiptSource = "amazon" | "rakuten" | "photo";

export interface Receipt {
  id: string;
  imageUrl: string;
  date: string; // YYYY-MM-DD
  storeName: string;
  totalAmount: number;
  tax: number;
  items: ReceiptItem[];
  paymentMethod: string;
  category: string;
  memo: string;
  analyzedAt: string; // ISO 8601
  createdAt: string;
  updatedAt: string;
  source: ReceiptSource;
  orderNumber: string;
  receiptUrl: string;
}

export interface ReceiptCreateInput {
  image?: string; // base64 data URL (optional for Amazon/Rakuten)
  date: string;
  storeName: string;
  totalAmount: number;
  tax: number;
  items: ReceiptItem[];
  paymentMethod: string;
  category: string;
  memo: string;
  analyzedAt: string;
  source: ReceiptSource;
  orderNumber?: string;
  receiptUrl?: string;
}

export interface MonthlyAggregation {
  yearMonth: string; // YYYY-MM
  totalAmount: number;
  totalTax: number;
  count: number;
  receipts: Receipt[];
}

export interface GeminiReceiptAnalysis {
  date: string;
  storeName: string;
  totalAmount: number;
  tax: number;
  items: ReceiptItem[];
  paymentMethod: string;
  category: string;
}

export const RECEIPT_CATEGORIES = [
  "食費",
  "交通費",
  "通信費",
  "消耗品費",
  "交際費",
  "雑費",
  "医療費",
  "住居費",
  "光熱費",
  "その他",
] as const;
