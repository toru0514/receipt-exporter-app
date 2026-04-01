import { NextRequest, NextResponse } from "next/server";
import { getReceipts, createReceipt, updateReceipt, deleteReceipt } from "@/lib/receipt-db";
import { analyzeReceiptImage } from "@/lib/gemini-receipt";
import { validateYearMonth, validatePagination, validateAmount, validateDateString } from "@/lib/validation";

/** GET: 領収書一覧取得（月別フィルタ対応） */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const search = searchParams.get("search");
    const category = searchParams.get("category");

    const ymResult = validateYearMonth(yearParam, monthParam);
    if (!ymResult.valid) {
      return NextResponse.json({ error: ymResult.error }, { status: 400 });
    }

    const pgResult = validatePagination(limitParam, offsetParam);
    if (!pgResult.valid) {
      return NextResponse.json({ error: pgResult.error }, { status: 400 });
    }

    const result = await getReceipts({
      year: ymResult.year,
      month: ymResult.month,
      limit: pgResult.limit,
      offset: pgResult.offset,
      search: search || undefined,
      category: category || undefined,
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

/** POST: 画像をアップロード → Gemini解析 → Supabaseに保存 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, imageUrl } = body as { image: string; imageUrl?: string };

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
      imageUrl,
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

/** PATCH: 領収書更新 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...fields } = body as { id: string; [key: string]: unknown };

    if (!id) {
      return NextResponse.json(
        { error: "IDが必要です" },
        { status: 400 }
      );
    }

    // 日付が含まれる場合はバリデーション
    if (fields.date !== undefined) {
      const dateResult = validateDateString(fields.date);
      if (!dateResult.valid) {
        return NextResponse.json({ error: dateResult.error }, { status: 400 });
      }
    }

    // totalAmountが含まれる場合はバリデーション
    if (fields.totalAmount !== undefined) {
      const amountResult = validateAmount(fields.totalAmount, "totalAmount");
      if (!amountResult.valid) {
        return NextResponse.json({ error: amountResult.error }, { status: 400 });
      }
    }

    const receipt = await updateReceipt(id, fields);
    return NextResponse.json({ receipt });
  } catch (error) {
    console.error("領収書更新エラー:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "領収書の更新に失敗しました",
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
