import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProvider } from "@/lib/providers";
import type { EmailSource } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { errorTracker } from "@/lib/error-tracker";
import { metrics } from "@/lib/metrics";
import { toAppError, errorToResponse } from "@/lib/errors";

const log = logger.child({ route: "/api/gmail" });

// Gmail API: 1分あたり10リクエストまで
const RATE_LIMIT_OPTIONS = { windowMs: 60_000, maxRequests: 10 };

export async function GET(request: NextRequest) {
  const endRequest = metrics.startRequest("/api/gmail");

  const session = await auth();
  if (!session?.accessToken) {
    log.warn("Unauthorized request");
    metrics.recordFailure("/api/gmail");
    endRequest();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // レート制限チェック
  const rateLimitKey = `gmail:${session.accessToken.slice(-16)}`;
  const rl = rateLimit(rateLimitKey, RATE_LIMIT_OPTIONS);
  if (!rl.allowed) {
    log.warn("Rate limit exceeded", { retryAfterMs: rl.retryAfterMs });
    metrics.recordFailure("/api/gmail");
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

  try {
    const providerParam = request.nextUrl.searchParams.get("provider") ?? "amazon";
    const source: EmailSource = (["amazon", "rakuten"].includes(providerParam)
      ? providerParam
      : "amazon") as EmailSource;

    log.info("Fetching emails", { provider: source });

    const pageToken = request.nextUrl.searchParams.get("pageToken") ?? undefined;
    const after = request.nextUrl.searchParams.get("after") ?? undefined;
    const before = request.nextUrl.searchParams.get("before") ?? undefined;
    const regionParam = request.nextUrl.searchParams.get("region") ?? "jp";

    const dateFilter = after || before ? { after, before } : undefined;

    const provider = getProvider(source);
    const result = await provider.getEmails(session.accessToken, {
      maxResults: 20,
      pageToken,
      dateFilter,
      region: source === "amazon" ? regionParam : undefined,
    });

    log.info("Emails fetched successfully", { count: result.emails.length });
    metrics.recordSuccess("/api/gmail");
    endRequest();
    return NextResponse.json({
      emails: result.emails,
      nextPageToken: result.nextPageToken,
    });
  } catch (error) {
    const appError = toAppError(error, "GMAIL_FETCH_FAILED");
    console.error("Gmail API error:", error);
    log.error("Gmail API request failed", {
      error: error instanceof Error ? error.message : String(error),
      errorCode: appError.code,
    });
    errorTracker.captureException(error, { module: "api/gmail" });
    metrics.recordFailure("/api/gmail");
    endRequest();
    const { body, status } = errorToResponse(appError);
    return NextResponse.json(body, { status });
  }
}
