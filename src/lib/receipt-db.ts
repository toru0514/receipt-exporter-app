import { getSupabase } from "./supabase/db";
import type { Receipt, ReceiptCreateInput, ReceiptSource } from "./receipt-types";
import type { ParsedOrder } from "./types";
import { getDefaultReceiptUrl } from "./receipt-url";

/** Supabase行 → Receipt 変換 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toReceipt(row: any): Receipt {
  return {
    id: row.id,
    imageUrl: row.image_url ?? "",
    date: row.date ?? "",
    storeName: row.store_name ?? "",
    totalAmount: row.total_amount ?? 0,
    tax: row.tax ?? 0,
    items: row.items ?? [],
    paymentMethod: row.payment_method ?? "",
    category: row.category ?? "",
    memo: row.memo ?? "",
    analyzedAt: row.analyzed_at ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: (row.source as ReceiptSource) ?? "photo",
    orderNumber: row.order_number ?? "",
    receiptUrl: row.receipt_url ?? "",
  };
}

/** 領収書一覧を取得（月別・ソースフィルタ・検索対応） */
export async function getReceipts(params?: {
  year?: number;
  month?: number;
  limit?: number;
  offset?: number;
  source?: ReceiptSource;
  search?: string;
  category?: string;
}): Promise<{ receipts: Receipt[]; totalCount: number }> {
  const limit = params?.limit ?? 100;
  const offset = params?.offset ?? 0;

  const supabase = getSupabase();
  let query = supabase
    .from("receipts")
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

  if (params?.source) {
    query = query.eq("source", params.source);
  }

  if (params?.search) {
    const escaped = params.search.replace(/[%_\\]/g, "\\$&");
    query = query.ilike("store_name", `%${escaped}%`);
  }

  if (params?.category) {
    query = query.eq("category", params.category);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`領収書取得エラー: ${error.message}`);

  return {
    receipts: (data ?? []).map(toReceipt),
    totalCount: count ?? 0,
  };
}

/** 領収書を新規作成 */
export async function createReceipt(
  input: ReceiptCreateInput
): Promise<Receipt> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("receipts")
    .insert({
      image_url: input.imageUrl || input.image || "",
      date: input.date,
      store_name: input.storeName,
      total_amount: input.totalAmount,
      tax: input.tax,
      items: input.items,
      payment_method: input.paymentMethod,
      category: input.category,
      memo: input.memo,
      analyzed_at: input.analyzedAt || null,
      source: input.source,
      order_number: input.orderNumber ?? "",
      receipt_url: input.receiptUrl ?? "",
    })
    .select()
    .single();

  if (error) throw new Error(`領収書登録エラー: ${error.message}`);
  return toReceipt(data);
}

/** 注文番号で既存レシートを検索（重複チェック用） */
export async function findReceiptByOrderNumber(
  orderNumber: string
): Promise<Receipt | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .eq("order_number", orderNumber)
    .limit(1);

  if (error) throw new Error(`領収書検索エラー: ${error.message}`);
  if (!data || data.length === 0) return null;
  return toReceipt(data[0]);
}

/** ParsedOrder から Receipt を作成してSupabaseに保存 */
export async function createReceiptFromOrder(
  order: ParsedOrder
): Promise<Receipt> {
  const storeName = order.source === "amazon" ? "Amazon" : "楽天市場";
  const receiptUrl =
    order.receiptUrl || getDefaultReceiptUrl(order.source, order.orderNumber);

  return createReceipt({
    date: order.orderDate,
    storeName,
    totalAmount: order.totalAmount,
    tax: order.tax,
    items: order.items,
    paymentMethod: "",
    category: "",
    memo: "",
    analyzedAt: new Date().toISOString(),
    source: order.source,
    orderNumber: order.orderNumber,
    receiptUrl,
  });
}

/** 領収書を更新 */
export async function updateReceipt(
  id: string,
  input: Partial<Omit<ReceiptCreateInput, "image" | "imageUrl" | "analyzedAt" | "source" | "orderNumber" | "receiptUrl">>
): Promise<Receipt> {
  const supabase = getSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};
  if (input.date !== undefined) updateData.date = input.date;
  if (input.storeName !== undefined) updateData.store_name = input.storeName;
  if (input.totalAmount !== undefined) updateData.total_amount = input.totalAmount;
  if (input.tax !== undefined) updateData.tax = input.tax;
  if (input.items !== undefined) updateData.items = input.items;
  if (input.paymentMethod !== undefined) updateData.payment_method = input.paymentMethod;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.memo !== undefined) updateData.memo = input.memo;

  const { data, error } = await supabase
    .from("receipts")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`領収書更新エラー: ${error.message}`);
  return toReceipt(data);
}

/** 領収書を削除 */
export async function deleteReceipt(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("receipts").delete().eq("id", id);
  if (error) throw new Error(`領収書削除エラー: ${error.message}`);
}
