import { NextResponse } from "next/server";

export async function GET() {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN;
  const apiKey = process.env.MICROCMS_API_KEY;

  if (!serviceDomain || !apiKey) {
    return NextResponse.json(
      { error: "microCMS設定が不足しています" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://${serviceDomain}.microcms-management.io/api/v1/media?limit=50`,
      {
        headers: {
          "X-MICROCMS-API-KEY": apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `メディア取得に失敗しました: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    // 画像のみフィルタ
    const images = (data.media ?? []).filter(
      (item: { contentType?: string }) =>
        item.contentType?.startsWith("image/")
    );

    return NextResponse.json({ media: images });
  } catch (error) {
    console.error("microCMSメディア取得エラー:", error);
    return NextResponse.json(
      { error: "メディア取得に失敗しました" },
      { status: 500 }
    );
  }
}
