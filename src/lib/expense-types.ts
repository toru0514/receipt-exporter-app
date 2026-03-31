export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  payeeName: string; // 支払先
  description: string; // 内容
  amount: number; // 金額
  notes: string; // 備考
  photoUrl: string; // 写真URL
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseCreateInput {
  date: string;
  payeeName: string;
  description: string;
  amount: number;
  notes: string;
  photoUrl: string;
}
