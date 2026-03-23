export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export type EmailSource = "amazon" | "rakuten";

export interface OrderEmail {
  id: string;
  threadId: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  source: EmailSource;
}

/** 後方互換エイリアス */
export type AmazonEmail = OrderEmail;

export interface ParsedOrder {
  orderDate: string;
  orderNumber: string;
  items: OrderItem[];
  totalAmount: number;
  tax: number;
  receiptUrl: string;
  source: EmailSource;
}

export interface AnalysisResult {
  email: AmazonEmail;
  order: ParsedOrder | null;
  error?: string;
}
