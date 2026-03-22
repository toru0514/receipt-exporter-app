import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAmazonEmails } from "@/lib/gmail";
import { rateLimit } from "@/lib/rate-limit";

// Gmail API: 1分あたり10リクエストまで
const RATE_LIMIT_OPTIONS = { windowMs: 60_000, maxRequests: 10 };

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // レート制限チェック
  const rateLimitKey = `gmail:${session.accessToken.slice(-16)}`;
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

  try {
    const emails = await getAmazonEmails(session.accessToken);
    return NextResponse.json({ emails });
  } catch (error) {
    console.error("Gmail API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}
