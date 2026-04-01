import { getSupabase } from "./supabase/db";
import type { Expense, ExpenseCreateInput, ExpenseUpdateInput } from "./expense-types";

/** DB行からphotoUrlsを復元する */
function parsePhotoUrls(row: Record<string, unknown>): string[] {
  // photo_urls (jsonb配列) を優先、なければ photo_url (旧カラム) にフォールバック
  if (Array.isArray(row.photo_urls)) {
    return row.photo_urls.filter((u: unknown) => typeof u === "string" && u !== "");
  }
  // 旧カラムが残っている場合の互換処理
  if (typeof row.photo_url === "string" && row.photo_url !== "") {
    return [row.photo_url];
  }
  return [];
}

/** 出金一覧を取得（月別フィルタ・検索対応） */
export async function getExpenses(params?: {
  year?: number;
  month?: number;
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<{ expenses: Expense[]; totalCount: number }> {
  const limit = params?.limit ?? 100;
  const offset = params?.offset ?? 0;

  const supabase = getSupabase();
  let query = supabase
    .from("expenses")
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

  if (params?.search) {
    const escaped = params.search.replace(/[%_\\]/g, "\\$&");
    query = query.ilike("payee_name", `%${escaped}%`);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`出金取得エラー: ${error.message}`);

  const expenses: Expense[] = (data ?? []).map((row) => ({
    id: row.id,
    date: row.date ?? "",
    payeeName: row.payee_name ?? "",
    description: row.description ?? "",
    amount: row.amount ?? 0,
    notes: row.notes ?? "",
    photoUrls: parsePhotoUrls(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return { expenses, totalCount: count ?? 0 };
}

/** 過去の支払先名一覧を取得（重複排除） */
export async function getDistinctPayees(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("expenses")
    .select("payee_name")
    .not("payee_name", "eq", "")
    .order("payee_name");

  if (error) throw new Error(`支払先取得エラー: ${error.message}`);

  const payees = (data ?? []).map((row) => row.payee_name as string);
  return Array.from(new Set(payees)).sort();
}

/** 出金を新規作成 */
export async function createExpense(
  input: ExpenseCreateInput
): Promise<Expense> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      date: input.date,
      payee_name: input.payeeName,
      description: input.description,
      amount: input.amount,
      notes: input.notes,
      photo_urls: input.photoUrls,
    })
    .select()
    .single();

  if (error) throw new Error(`出金登録エラー: ${error.message}`);

  return {
    id: data.id,
    date: data.date ?? "",
    payeeName: data.payee_name ?? "",
    description: data.description ?? "",
    amount: data.amount ?? 0,
    notes: data.notes ?? "",
    photoUrls: parsePhotoUrls(data),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/** 出金を更新 */
export async function updateExpense(
  id: string,
  input: ExpenseUpdateInput
): Promise<Expense> {
  const supabase = getSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};
  if (input.date !== undefined) updateData.date = input.date;
  if (input.payeeName !== undefined) updateData.payee_name = input.payeeName;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.amount !== undefined) updateData.amount = input.amount;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.photoUrls !== undefined) updateData.photo_urls = input.photoUrls;

  const { data, error } = await supabase
    .from("expenses")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`出金更新エラー: ${error.message}`);

  return {
    id: data.id,
    date: data.date ?? "",
    payeeName: data.payee_name ?? "",
    description: data.description ?? "",
    amount: data.amount ?? 0,
    notes: data.notes ?? "",
    photoUrls: parsePhotoUrls(data),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/** 出金を削除 */
export async function deleteExpense(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(`出金削除エラー: ${error.message}`);
}
