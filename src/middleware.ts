import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * ミドルウェア: API ルートの基本的なセキュリティ保護
 *
 * - API レスポンスにセキュリティヘッダーを付与
 * - 環境変数の漏洩防止（レスポンスボディに API キー等が含まれないことを保証する
 *   のはサーバー側ロジックの責任だが、ここでは基本的なヘッダー保護を行う）
 */
export function middleware(request: NextRequest) {
  // API ルートの場合、不正なメソッドを拒否
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const response = NextResponse.next();

    // API レスポンスにキャッシュ制御ヘッダーを付与
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
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
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
