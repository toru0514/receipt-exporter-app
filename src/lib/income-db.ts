import { getSupabase } from "./supabase";
import type { Income, IncomeCreateInput } from "./income-types";

/** 入金一覧を取得（月別フィルタ対応） */
export async function getIncomes(params?: {
  year?: number;
  month?: number;
  limit?: number;
  offset?: number;
}): Promise<{ incomes: Income[]; totalCount: number }> {
  const limit = params?.limit ?? 100;
  const offset = params?.offset ?? 0;

  const supabase = getSupabase();
  let query = supabase
    .from("incomes")
    .select("*", { count: "exact" })
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params?.year && params?.month) {
    const startDate = `${params.year}-${String(params.month).padStart(2, "0")}-01`;
    const endMonth = params.month === 12 ? 1 : params.month + 1;
    const endYear = params.month === 12 ? params.year + 1 : params.year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    query = query.gte("date", startDate).lt("date", endDate);
  } else if (params?.year) {
    query = query
      .gte("date", `${params.year}-01-01`)
      .lt("date", `${params.year + 1}-01-01`);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`入金取得エラー: ${error.message}`);

  const incomes: Income[] = (data ?? []).map((row) => ({
    id: row.id,
    date: row.date ?? "",
    clientName: row.client_name ?? "",
    description: row.description ?? "",
    amount: row.amount ?? 0,
    notes: row.notes ?? "",
    photoUrl: row.photo_url ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return { incomes, totalCount: count ?? 0 };
}

/** 過去の客先名一覧を取得（重複排除） */
export async function getDistinctClients(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("incomes")
    .select("client_name")
    .not("client_name", "eq", "")
    .order("client_name");

  if (error) throw new Error(`客先取得エラー: ${error.message}`);

  const clients = (data ?? []).map((row) => row.client_name as string);
  return Array.from(new Set(clients)).sort();
}

/** 入金を新規作成 */
export async function createIncome(
  input: IncomeCreateInput
): Promise<Income> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("incomes")
    .insert({
      date: input.date,
      client_name: input.clientName,
      description: input.description,
      amount: input.amount,
      notes: input.notes,
      photo_url: input.photoUrl,
    })
    .select()
    .single();

  if (error) throw new Error(`入金登録エラー: ${error.message}`);

  return {
    id: data.id,
    date: data.date ?? "",
    clientName: data.client_name ?? "",
    description: data.description ?? "",
    amount: data.amount ?? 0,
    notes: data.notes ?? "",
    photoUrl: data.photo_url ?? "",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/** 入金を削除 */
export async function deleteIncome(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("incomes").delete().eq("id", id);
  if (error) throw new Error(`入金削除エラー: ${error.message}`);
}
