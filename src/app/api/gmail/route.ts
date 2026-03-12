import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAmazonEmails } from "@/lib/gmail";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
