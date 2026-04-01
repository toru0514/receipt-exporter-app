import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";
import { withRetry } from "./retry";
import type { GeminiReceiptAnalysis } from "./receipt-types";

const RECEIPT_ANALYSIS_PROMPT = `あなたは領収書・レシートの画像から情報を抽出するアシスタントです。
以下の画像から領収書の情報を抽出し、JSON形式で返してください。

抽出する項目:
- date: 日付（YYYY-MM-DD形式）。不明な場合は空文字。
- storeName: 店舗名・発行元
- totalAmount: 合計金額（数値、円単位）。カンマや￥記号は除去。例: ￥2,673 → 2673
- tax: 消費税額（数値、円単位。不明な場合は0）
- items: 品目リスト（各品目のname, quantity, price）。品目が読み取れない場合は空配列。
- paymentMethod: 支払方法（現金、クレジットカード、電子マネー等。不明な場合は空文字）
- category: 経費カテゴリの推定。以下から最も適切なものを選択:
  旅費交通費、通信費、接待交際費、会議費、消耗品費、事務用品費、新聞図書費、水道光熱費、地代家賃、広告宣伝費、外注費、支払手数料、租税公課、保険料、修繕費、福利厚生費、荷造運賃、車両費、研修費、雑費、その他

注意:
- 金額は数値のみで返す（カンマや￥記号は除去）
- 読み取れない項目はデフォルト値（空文字、0、空配列）を返す
`;

const RECEIPT_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    date: { type: SchemaType.STRING, description: "日付（YYYY-MM-DD形式）" },
    storeName: { type: SchemaType.STRING, description: "店舗名・発行元" },
    totalAmount: { type: SchemaType.NUMBER, description: "合計金額（円単位）" },
    tax: { type: SchemaType.NUMBER, description: "消費税額（円単位）" },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          quantity: { type: SchemaType.NUMBER },
          price: { type: SchemaType.NUMBER },
        },
        required: ["name", "quantity", "price"],
      },
      description: "品目リスト",
    },
    paymentMethod: { type: SchemaType.STRING, description: "支払方法" },
    category: { type: SchemaType.STRING, description: "経費カテゴリ" },
  },
  required: ["date", "storeName", "totalAmount", "tax", "items", "paymentMethod", "category"],
};

function toReceiptAnalysis(
  parsed: Record<string, unknown>
): GeminiReceiptAnalysis {
  return {
    date: typeof parsed.date === "string" ? parsed.date : "",
    storeName: typeof parsed.storeName === "string" ? parsed.storeName : "",
    totalAmount: Number(parsed.totalAmount) || 0,
    tax: Number(parsed.tax) || 0,
    items: Array.isArray(parsed.items)
      ? parsed.items.map(
          (item: { name?: string; quantity?: number; price?: number }) => ({
            name: item.name || "",
            quantity: item.quantity || 1,
            price: item.price || 0,
          })
        )
      : [],
    paymentMethod:
      typeof parsed.paymentMethod === "string" ? parsed.paymentMethod : "",
    category: typeof parsed.category === "string" ? parsed.category : "その他",
  };
}

/**
 * 領収書画像をGeminiで解析し、構造化データを返す
 * @param imageBase64 base64エンコードされた画像データ（data URL形式）
 * @param apiKey Gemini APIキー
 */
export async function analyzeReceiptImage(
  imageBase64: string,
  apiKey: string
): Promise<GeminiReceiptAnalysis | null> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RECEIPT_RESPONSE_SCHEMA,
    },
  });

  // data URLからbase64部分とmimeTypeを抽出
  const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    throw new Error("無効な画像データ形式です。data URL形式で指定してください。");
  }
  const mimeType = matches[1];
  const data = matches[2];

  const result = await withRetry(
    () =>
      model.generateContent([
        RECEIPT_ANALYSIS_PROMPT,
        {
          inlineData: {
            mimeType,
            data,
          },
        },
      ]),
    {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      onRetry: (attempt, error, delayMs) => {
        console.warn(
          `[Gemini Receipt] リトライ ${attempt}/3 (${delayMs}ms後): ${error instanceof Error ? error.message : String(error)}`
        );
      },
    }
  );

  const response = result.response;
  const text = response.text();

  try {
    const parsed = JSON.parse(text);
    return toReceiptAnalysis(parsed as Record<string, unknown>);
  } catch (e) {
    console.error("[Gemini Receipt] JSONパース失敗:", e, "response:", text.slice(0, 500));
    return null;
  }
}
