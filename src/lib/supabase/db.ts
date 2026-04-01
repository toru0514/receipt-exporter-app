import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

/**
 * サーバーサイド用 Supabase クライアント（サービスロールキー使用）
 *
 * サービスロールキーは RLS をバイパスするため、
 * APIルートやサーバーアクションなどサーバーサイドでのみ使用すること。
 * クライアントサイドには絶対に露出させないこと。
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を環境変数に設定してください"
      );
    }

    _supabase = createClient(supabaseUrl, serviceRoleKey);
  }
  return _supabase;
}
