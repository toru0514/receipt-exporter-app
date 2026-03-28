import { NextResponse } from "next/server";
import { metrics } from "@/lib/metrics";

export async function GET() {
  const summary = metrics.getSummary();

  return NextResponse.json({
    status: "ok",
    ...summary,
  });
}
