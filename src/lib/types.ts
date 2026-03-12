export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ParsedOrder {
  orderDate: string;
  orderNumber: string;
  items: OrderItem[];
  totalAmount: number;
  tax: number;
  receiptUrl: string;
}

export interface AmazonEmail {
  id: string;
  threadId: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
}

export interface AnalysisResult {
  email: AmazonEmail;
  order: ParsedOrder | null;
  error?: string;
}
