import { NextResponse } from "next/server";
import { metrics } from "@/lib/metrics";

export async function GET() {
  const summary = metrics.getSummary();

  // デバッグ: プロバイダーモジュールの読み込みテスト
  const diagnostics: Record<string, string> = {};
  try {
    const { getProvider } = await import("@/lib/providers");
    const provider = getProvider("amazon");
    diagnostics.providers = `ok (source=${provider.source})`;
  } catch (e) {
    diagnostics.providers = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const { fetchAndParseEmails } = await import("@/lib/gmail");
    diagnostics.gmail = typeof fetchAndParseEmails === "function" ? "ok" : "not a function";
  } catch (e) {
    diagnostics.gmail = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({
    status: "ok",
    diagnostics,
    ...summary,
  });
}
