import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * ミドルウェア:
 * - nonce ベースの CSP ヘッダー設定
 * - Supabase Auth によるルート保護（未認証 → /login リダイレクト）
 * - API ルートのセキュリティヘッダー付与
 * - 環境変数の漏洩防止
 */
export async function middleware(request: NextRequest) {
  // nonce を生成（Base64 エンコードされたランダム値）
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // リクエストヘッダーに nonce を追加（レイアウトで headers() 経由で読み取れる）
  request.headers.set("x-nonce", nonce);

  // Supabase Auth セッション管理・ルート保護
  const response = await updateSession(request);

  // リダイレクトレスポンスの場合はそのまま返す
  if (response.status === 307 || response.status === 308) {
    return response;
  }

  // 開発環境では unsafe-eval が必要（Next.js の HMR / Fast Refresh）
  const isDev = process.env.NODE_ENV === "development";
  const evalDirective = isDev ? " 'unsafe-eval'" : "";

  // CSP ディレクティブの構築（nonce ベース）
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${evalDirective}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://accounts.google.com https://www.googleapis.com https://generativelanguage.googleapis.com https://images.microcms-assets.io https://*.supabase.co",
    "frame-src 'self' https://accounts.google.com",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");

  // CSP ヘッダーを設定
  response.headers.set("Content-Security-Policy", cspDirectives);

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
