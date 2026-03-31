import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * ミドルウェア:
 * - Supabase Auth によるルート保護（未認証 → /login リダイレクト）
 * - API ルートのセキュリティヘッダー付与
 * - 環境変数の漏洩防止
 */
export async function middleware(request: NextRequest) {
  // Supabase Auth セッション管理・ルート保護
  const response = await updateSession(request);

  // リダイレクトレスポンスの場合はそのまま返す
  if (response.status === 307 || response.status === 308) {
    return response;
  }

  // API ルートの場合、セキュリティヘッダーを付与
  if (request.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );
    response.headers.set("Pragma", "no-cache");

    // 環境変数名がクエリパラメータに含まれていたら拒否
    const sensitivePatterns = [
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_GEMINI_API_KEY",
      "NEXTAUTH_SECRET",
    ];

    const url = request.nextUrl.toString().toUpperCase();
    for (const pattern of sensitivePatterns) {
      if (url.includes(pattern)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
