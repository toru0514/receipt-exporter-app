import { NextRequest, NextResponse } from "next/server";
import { getReceipts, createReceipt, deleteReceipt } from "@/lib/receipt-db";
import { analyzeReceiptImage } from "@/lib/gemini-receipt";

/** GET: 領収書一覧取得（月別フィルタ対応） */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    const result = await getReceipts({
      year: year ? parseInt(year) : undefined,
      month: month ? parseInt(month) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("領収書取得エラー:", error);
    return NextResponse.json(
      { error: "領収書の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/** POST: 画像をアップロード → Gemini解析 → microCMSに保存 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image } = body as { image: string };

    if (!image) {
      return NextResponse.json(
        { error: "画像データが必要です" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini APIキーが設定されていません" },
        { status: 500 }
      );
    }

    // Geminiで画像解析
    const analysis = await analyzeReceiptImage(image, apiKey);
    if (!analysis) {
      return NextResponse.json(
        { error: "領収書の解析に失敗しました。画像を確認してください。" },
        { status: 422 }
      );
    }

    // Supabaseに保存
    const receipt = await createReceipt({
      image,
      date: analysis.date,
      storeName: analysis.storeName,
      totalAmount: analysis.totalAmount,
      tax: analysis.tax,
      items: analysis.items,
      paymentMethod: analysis.paymentMethod,
      category: analysis.category,
      memo: "",
      analyzedAt: new Date().toISOString(),
      source: "photo",
    });

    return NextResponse.json({ receipt, analysis }, { status: 201 });
  } catch (error) {
    console.error("領収書登録エラー:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "領収書の登録に失敗しました",
      },
      { status: 500 }
    );
  }
}

/** DELETE: 領収書削除 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "IDが必要です" },
        { status: 400 }
      );
    }

    await deleteReceipt(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("領収書削除エラー:", error);
    return NextResponse.json(
      { error: "領収書の削除に失敗しました" },
      { status: 500 }
    );
  }
}
