import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN;
  const apiKey = process.env.MICROCMS_API_KEY;

  if (!serviceDomain || !apiKey) {
    return NextResponse.json(
      { error: "microCMS環境変数が設定されていません" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const offset = searchParams.get("offset") || "0";
  const limit = searchParams.get("limit") || "20";

  try {
    const res = await fetch(
      `https://${serviceDomain}.microcms-management.io/api/v1/media?offset=${offset}&limit=${limit}`,
      {
        headers: {
          "X-MICROCMS-API-KEY": apiKey,
        },
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: `microCMSメディア取得に失敗: ${errorText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("microCMSメディア取得エラー:", error);
    return NextResponse.json(
      { error: "メディア取得に失敗しました" },
      { status: 500 }
    );
  }
}
