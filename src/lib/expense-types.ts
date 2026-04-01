export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  payeeName: string; // 支払先
  description: string; // 内容
  amount: number; // 金額
  category: string; // 会計カテゴリ
  notes: string; // 備考
  photoUrls: string[]; // 写真URL（複数）
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseCreateInput {
  date: string;
  payeeName: string;
  description: string;
  amount: number;
  category: string;
  notes: string;
  photoUrls: string[];
}

export type ExpenseUpdateInput = Partial<ExpenseCreateInput>;
