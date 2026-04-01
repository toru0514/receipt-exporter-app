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
  imageUrl?: string; // 既存のmicroCMS画像URL（指定時はアップロードをスキップ）
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

export const PAYMENT_METHODS = [
  "現金",
  "クレジットカード",
  "銀行振込",
  "口座振替",
  "電子マネー",
  "QRコード決済",
  "デビットカード",
  "手形・小切手",
  "その他",
] as const;

export const RECEIPT_CATEGORIES = [
  "旅費交通費",
  "通信費",
  "接待交際費",
  "会議費",
  "消耗品費",
  "事務用品費",
  "新聞図書費",
  "水道光熱費",
  "地代家賃",
  "広告宣伝費",
  "外注費",
  "支払手数料",
  "租税公課",
  "保険料",
  "修繕費",
  "福利厚生費",
  "荷造運賃",
  "車両費",
  "研修費",
  "雑費",
  "その他",
] as const;
