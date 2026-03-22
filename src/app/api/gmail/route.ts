import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAmazonEmails, AmazonRegion } from "@/lib/gmail";
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
    log.info("Fetching Amazon emails");
    const pageToken = request.nextUrl.searchParams.get("pageToken") ?? undefined;
    const after = request.nextUrl.searchParams.get("after") ?? undefined;
    const before = request.nextUrl.searchParams.get("before") ?? undefined;
    const regionParam = request.nextUrl.searchParams.get("region") ?? "jp";
    const region: AmazonRegion = (["jp", "us", "all"].includes(regionParam)
      ? regionParam
      : "jp") as AmazonRegion;

    const dateFilter = after || before ? { after, before } : undefined;
    const result = await getAmazonEmails(session.accessToken, 20, pageToken, region, dateFilter);
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
