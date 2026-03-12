import { GoogleGenerativeAI } from "@google/generative-ai";
import { ParsedOrder } from "./types";

const EXTRACTION_PROMPT = `あなたはAmazon.co.jpの注文確認メールから注文情報を抽出するアシスタントです。
以下のHTMLメール本文から、注文情報を抽出してJSON形式で返してください。

抽出する項目:
- orderDate: 注文日（YYYY-MM-DD形式）
- orderNumber: 注文番号（例: 250-1234567-1234567）
- items: 商品リスト（各商品のname, quantity, price）
- totalAmount: 合計金額（数値、円単位）
- tax: 消費税額（数値、円単位。不明な場合は0）
- receiptUrl: 領収書URL（メール内にリンクがあれば。なければ空文字）

注意:
- 金額は数値のみ（カンマや￥記号は除去）
- 複数商品がある場合はitemsに全て含める
- 情報が見つからない場合はnullを返す
- 必ずJSON形式のみで返してください（説明文は不要）

メール本文:
`;

export async function analyzeEmailWithGemini(
  emailHtml: string,
  apiKey: string
): Promise<ParsedOrder | null> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const truncatedHtml =
    emailHtml.length > 30000 ? emailHtml.substring(0, 30000) : emailHtml;

  const result = await model.generateContent(EXTRACTION_PROMPT + truncatedHtml);
  const response = result.response;
  const text = response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || parsed === null) return null;

    return {
      orderDate: parsed.orderDate || "",
      orderNumber: parsed.orderNumber || "",
      items: Array.isArray(parsed.items)
        ? parsed.items.map(
            (item: { name?: string; quantity?: number; price?: number }) => ({
              name: item.name || "",
              quantity: item.quantity || 1,
              price: item.price || 0,
            })
          )
        : [],
      totalAmount: Number(parsed.totalAmount) || 0,
      tax: Number(parsed.tax) || 0,
      receiptUrl: parsed.receiptUrl || "",
    };
  } catch {
    return null;
  }
}
