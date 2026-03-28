import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analyzeEmailWithGemini, analyzeEmailsBatch } from "@/lib/gemini";
import { rateLimit } from "@/lib/rate-limit";
import { validateEmailHtml } from "@/lib/validation";
import { TTLCache } from "@/lib/cache";
import { ParsedOrder } from "@/lib/types";
import type { EmailSource } from "@/lib/types";
import { logger } from "@/lib/logger";
import { errorTracker } from "@/lib/error-tracker";
import { metrics } from "@/lib/metrics";
import { toAppError, errorToResponse } from "@/lib/errors";

const log = logger.child({ route: "/api/analyze" });

// Analyze API: 1分あたり20リクエストまで
const RATE_LIMIT_OPTIONS = { windowMs: 60_000, maxRequests: 20 };

// 解析結果キャッシュ（TTL: 30分、最大500件）
const analysisCache = new TTLCache<ParsedOrder | null>(30 * 60 * 1000, 500);

export async function POST(request: NextRequest) {
  const endRequest = metrics.startRequest("/api/analyze");

  const session = await auth();
  if (!session?.accessToken) {
    log.warn("Unauthorized request");
    metrics.recordFailure("/api/analyze");
    endRequest();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // レート制限チェック
  const rateLimitKey = `analyze:${session.accessToken.slice(-16)}`;
  const rl = rateLimit(rateLimitKey, RATE_LIMIT_OPTIONS);
  if (!rl.allowed) {
    log.warn("Rate limit exceeded", { retryAfterMs: rl.retryAfterMs });
    metrics.recordFailure("/api/analyze");
    endRequest();
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
    log.error("Gemini API key not configured");
    metrics.recordFailure("/api/analyze");
    endRequest();
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
      log.warn("Invalid JSON body received");
      metrics.recordFailure("/api/analyze");
      endRequest();
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { emailHtml, emailId, source: sourceParam } = body as { emailHtml?: unknown; emailId?: unknown; source?: unknown };

    const source: EmailSource = (
      typeof sourceParam === "string" && ["amazon", "rakuten"].includes(sourceParam)
        ? sourceParam
        : "amazon"
    ) as EmailSource;

    // 入力値バリデーション
    const validation = validateEmailHtml(emailHtml);
    if (!validation.valid) {
      log.warn("Validation failed", { error: validation.error });
      metrics.recordFailure("/api/analyze");
      endRequest();
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // キャッシュチェック（emailId が提供されている場合）
    const cacheKey = typeof emailId === "string" && emailId.length > 0
      ? `${source}:${emailId}`
      : null;

    if (cacheKey) {
      const cached = analysisCache.get(cacheKey);
      if (cached !== undefined) {
        log.info("Cache hit for email analysis", { emailId });
        metrics.recordSuccess("/api/analyze");
        endRequest();
        return NextResponse.json({ order: cached, cached: true });
      }
    }

    log.info("Analyzing email with Gemini");
    const order = await analyzeEmailWithGemini(emailHtml as string, apiKey, source);

    // キャッシュに保存（emailId が提供されている場合）
    if (cacheKey) {
      analysisCache.set(cacheKey, order);
    }

    log.info("Email analysis completed", { hasOrder: order !== null });
    metrics.recordSuccess("/api/analyze");
    endRequest();
    return NextResponse.json({ order });
  } catch (error) {
    const appError = toAppError(error, "GEMINI_API_FAILED");
    console.error("Gemini analysis error:", error);
    log.error("Gemini analysis failed", {
      error: error instanceof Error ? error.message : String(error),
      errorCode: appError.code,
    });
    errorTracker.captureException(error, { module: "api/analyze" });
    metrics.recordFailure("/api/analyze");
    endRequest();
    const { body, status } = errorToResponse(appError);
    return NextResponse.json(body, { status });
  }
}

/**
 * PATCH: 複数メールの一括解析（部分的な失敗を許容）
 */
export async function PATCH(request: NextRequest) {
  const endRequest = metrics.startRequest("/api/analyze/batch");

  const session = await auth();
  if (!session?.accessToken) {
    log.warn("Unauthorized batch request");
    metrics.recordFailure("/api/analyze/batch");
    endRequest();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // レート制限チェック
  const rateLimitKey = `analyze:${session.accessToken.slice(-16)}`;
  const rl = rateLimit(rateLimitKey, RATE_LIMIT_OPTIONS);
  if (!rl.allowed) {
    log.warn("Rate limit exceeded for batch", { retryAfterMs: rl.retryAfterMs });
    metrics.recordFailure("/api/analyze/batch");
    endRequest();
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
    log.error("Gemini API key not configured");
    metrics.recordFailure("/api/analyze/batch");
    endRequest();
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
      log.warn("Invalid JSON body in batch request");
      metrics.recordFailure("/api/analyze/batch");
      endRequest();
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { emails, source: sourceParam } = body as {
      emails?: Array<{ id: string; body: string }>;
      source?: unknown;
    };

    const source: EmailSource = (
      typeof sourceParam === "string" && ["amazon", "rakuten"].includes(sourceParam)
        ? sourceParam
        : "amazon"
    ) as EmailSource;

    if (!Array.isArray(emails) || emails.length === 0) {
      log.warn("Invalid emails array in batch request");
      metrics.recordFailure("/api/analyze/batch");
      endRequest();
      return NextResponse.json(
        { error: "emails must be a non-empty array of { id, body }" },
        { status: 400 }
      );
    }

    if (emails.length > 50) {
      log.warn("Too many emails in batch request", { count: emails.length });
      metrics.recordFailure("/api/analyze/batch");
      endRequest();
      return NextResponse.json(
        { error: "Maximum 50 emails per batch request" },
        { status: 400 }
      );
    }

    log.info("Starting batch email analysis", { count: emails.length });
    const batchResult = await analyzeEmailsBatch(emails, apiKey, source);

    // 成功した結果をキャッシュに保存
    for (const result of batchResult.results) {
      if (result.order) {
        analysisCache.set(`${source}:${result.emailId}`, result.order);
      }
    }

    log.info("Batch analysis completed", {
      successCount: batchResult.successCount,
      failureCount: batchResult.failureCount,
    });
    metrics.recordSuccess("/api/analyze/batch");
    endRequest();

    return NextResponse.json({
      results: batchResult.results,
      summary: {
        total: emails.length,
        success: batchResult.successCount,
        failed: batchResult.failureCount,
      },
    });
  } catch (error) {
    const appError = toAppError(error, "GEMINI_API_FAILED");
    console.error("Batch analysis error:", error);
    log.error("Batch analysis failed", {
      error: error instanceof Error ? error.message : String(error),
      errorCode: appError.code,
    });
    errorTracker.captureException(error, { module: "api/analyze/batch" });
    metrics.recordFailure("/api/analyze/batch");
    endRequest();
    const { body, status } = errorToResponse(appError);
    return NextResponse.json(body, { status });
  }
}
