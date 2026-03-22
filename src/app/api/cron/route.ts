import { NextRequest, NextResponse } from "next/server";
import { runScheduledJob } from "@/lib/scheduled-job";
import { logger } from "@/lib/logger";

const log = logger.child({ route: "/api/cron" });

/**
 * 定期実行エンドポイント
 *
 * Vercel Cron または外部 cron サービスから呼び出される。
 * Authorization ヘッダーに CRON_SECRET と一致するトークンが必要。
 *
 * Usage:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" https://example.com/api/cron
 *
 * Query parameters:
 *   - accessToken: Gmail OAuth アクセストークン（必須）
 *   - maxEmails: 取得するメール数（デフォルト: 10）
 */
export async function GET(request: NextRequest) {
  // CRON_SECRET による認証
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    log.error("CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Cron endpoint is not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (token !== cronSecret) {
    log.warn("Unauthorized cron request");
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Gemini API キーの確認
  const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiApiKey) {
    log.error("GOOGLE_GEMINI_API_KEY is not configured");
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 }
    );
  }

  // アクセストークンはクエリパラメータまたはヘッダーから取得
  const accessToken =
    request.nextUrl.searchParams.get("accessToken") ??
    request.headers.get("x-access-token");

  if (!accessToken) {
    log.warn("Missing access token for cron job");
    return NextResponse.json(
      {
        error:
          "Access token is required. Provide via ?accessToken= query param or X-Access-Token header.",
      },
      { status: 400 }
    );
  }

  const maxEmails = Number(
    request.nextUrl.searchParams.get("maxEmails") ?? "10"
  );

  log.info("Cron job triggered", { maxEmails });

  const result = await runScheduledJob({
    accessToken,
    geminiApiKey,
    maxEmails,
  });

  const statusCode = result.status === "error" ? 500 : 200;

  return NextResponse.json(result, { status: statusCode });
}
