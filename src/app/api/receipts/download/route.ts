import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getReceipts } from "@/lib/receipt-db";

/** GET: 月別/年別の画像一括ダウンロード（ZIP） */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    if (!year) {
      return NextResponse.json(
        { error: "年を指定してください" },
        { status: 400 }
      );
    }

    const yearNum = parseInt(year);
    const monthNum = month ? parseInt(month) : undefined;

    // 全レシートを取得（最大500件）
    const { receipts } = await getReceipts({
      year: yearNum,
      month: monthNum,
      limit: 500,
    });

    // 画像付きレシートのみ対象
    const imageReceipts = receipts.filter((r) => r.imageUrl);

    if (imageReceipts.length === 0) {
      return NextResponse.json(
        { error: "画像付きの領収書がありません" },
        { status: 404 }
      );
    }

    const zip = new JSZip();
    const folderName = monthNum
      ? `receipts_${yearNum}_${String(monthNum).padStart(2, "0")}`
      : `receipts_${yearNum}`;
    const folder = zip.folder(folderName)!;

    // 各画像をダウンロードしてZIPに追加
    let index = 0;
    for (const receipt of imageReceipts) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const imageResponse = await fetch(receipt.imageUrl, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!imageResponse.ok) continue;

        const imageBuffer = await imageResponse.arrayBuffer();
        const ext = receipt.imageUrl.includes(".png") ? "png" : "jpg";
        const fileName = `${receipt.date}_${receipt.storeName || "unknown"}_${index}.${ext}`;
        const safeFileName = fileName.replace(/[/\\:*?"<>|]/g, "_");
        folder.file(safeFileName, imageBuffer);
        index++;
      } catch (err) {
        console.warn(`画像ダウンロードスキップ: ${receipt.imageUrl}`, err);
      }
    }

    if (index === 0) {
      return NextResponse.json(
        { error: "画像のダウンロードに失敗しました" },
        { status: 500 }
      );
    }

    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${folderName}.zip"`,
      },
    });
  } catch (error) {
    console.error("一括ダウンロードエラー:", error);
    return NextResponse.json(
      { error: "ダウンロードに失敗しました" },
      { status: 500 }
    );
  }
}
