import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analyzeEmailWithGemini } from "@/lib/gemini";
import { rateLimit } from "@/lib/rate-limit";
import { validateEmailHtml } from "@/lib/validation";

// Analyze API: 1分あたり20リクエストまで
const RATE_LIMIT_OPTIONS = { windowMs: 60_000, maxRequests: 20 };

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // レート制限チェック
  const rateLimitKey = `analyze:${session.accessToken.slice(-16)}`;
  const rl = rateLimit(rateLimitKey, RATE_LIMIT_OPTIONS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 }
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { emailHtml } = body as { emailHtml?: unknown };

    // 入力値バリデーション
    const validation = validateEmailHtml(emailHtml);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const order = await analyzeEmailWithGemini(emailHtml as string, apiKey);
    return NextResponse.json({ order });
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze email" },
      { status: 500 }
    );
  }
}
