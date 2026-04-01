export interface Income {
  id: string;
  date: string; // YYYY-MM-DD
  clientName: string;
  description: string;
  amount: number;
  notes: string;
  photoUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeCreateInput {
  date: string;
  clientName: string;
  description: string;
  amount: number;
  notes: string;
  photoUrl: string;
}

export type IncomeUpdateInput = Partial<IncomeCreateInput>;
