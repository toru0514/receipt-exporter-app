import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analyzeEmailWithGemini } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { emailHtml } = await request.json();
    if (!emailHtml) {
      return NextResponse.json(
        { error: "emailHtml is required" },
        { status: 400 }
      );
    }

    const order = await analyzeEmailWithGemini(emailHtml, apiKey);
    return NextResponse.json({ order });
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze email" },
      { status: 500 }
    );
  }
}
