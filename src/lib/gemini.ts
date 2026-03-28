import { GoogleGenerativeAI } from "@google/generative-ai";
import { ParsedOrder, EmailSource } from "./types";
import { withRetry } from "./retry";
import { AppError } from "./errors";
import { logger } from "./logger";
import { metrics } from "./metrics";

const EXTRACTION_PROMPT = `あなたはAmazon.co.jpの注文関連メール（注文確認、発送通知、配達通知など）から注文情報を抽出するアシスタントです。
以下のHTMLメール本文から、注文情報を抽出してJSON形式で返してください。
メールが転送メール（Fwd:）の場合も、転送元の本文から情報を抽出してください。

抽出する項目:
- orderDate: 注文日または発送日（YYYY-MM-DD形式）。メール内の日付情報から推定してください。
- orderNumber: 注文番号（例: 250-1234567-1234567）。メール件名に注文番号が含まれている場合はそれを優先してください。
- items: 商品リスト（各商品のname, quantity, price）
- totalAmount: 合計金額（数値、円単位）。「合計」「お支払い」「ご請求額」等の記載から取得。個別商品の価格しかない場合はその合計を計算。
- tax: 消費税額（数値、円単位。不明な場合は0）
- receiptUrl: 領収書URL（メール内にリンクがあれば。なければ空文字）

注意:
- 金額は数値のみ（カンマや￥記号は除去）。例: ￥2,673 → 2673
- 発送通知メールにも商品名と金額が含まれていることが多いので、必ず抽出すること
- 複数商品がある場合はitemsに全て含める
- メール内に複数の注文番号が含まれている場合は、メールの主題（件名やヘッダー部分に記載されている注文番号）を抽出すること。関連注文やおすすめ商品セクションの注文番号は無視すること。
- 情報が見つからない場合はnullを返す
- 必ずJSON形式のみで返してください（説明文は不要）
`;

const RAKUTEN_EXTRACTION_PROMPT = `あなたは楽天市場の注文確認メールから注文情報を抽出するアシスタントです。
以下のHTMLメール本文から、注文情報を抽出してJSON形式で返してください。
メールが転送メール（Fwd:）の場合も、転送元の本文から情報を抽出してください。

抽出する項目:
- orderDate: 注文日（YYYY-MM-DD形式）。「注文日時」の日付部分を使用。
- orderNumber: 注文番号（例: 393703-20260110-0005400563）
- items: 商品リスト（各商品のname, quantity, price）。priceは税込の単価。
- totalAmount: 支払い金額（数値、円単位）。「支払い金額」の記載から取得。
- tax: 消費税額（数値、円単位）。楽天メールでは消費税額が明示されていないことが多い。その場合は合計金額の10/110を概算値として算出（小数点以下切り捨て）。算出不能な場合は0。
- receiptUrl: 領収書URL（メール内にリンクがあれば。なければ空文字）

注意:
- 金額は数値のみ（カンマや￥記号は除去）。例: 1,587円 → 1587
- 「X,XXX円 x N個 = X,XXX円」パターンから各商品の単価と数量を読み取る
- 複数商品がある場合はitemsに全て含める
- 情報が見つからない場合はnullを返す
- 必ずJSON形式のみで返してください（説明文は不要）
`;

function getPromptForSource(source: EmailSource): string {
  switch (source) {
    case "rakuten":
      return RAKUTEN_EXTRACTION_PROMPT;
    case "amazon":
    default:
      return EXTRACTION_PROMPT;
  }
}

/**
 * 複数の戦略でGeminiレスポンスからJSONを抽出する。
 * 戦略:
 *   1. レスポンス全体をそのままJSONとしてパース
 *   2. マークダウンコードブロック内のJSONを抽出
 *   3. 最初の { から最後の } までを抽出（従来方式）
 *   4. 複数の { } ブロックから最大のものを試行
 */
export function extractJsonFromResponse(text: string): unknown | null {
  const trimmed = text.trim();

  // 戦略1: 全体をそのままパース
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed !== null && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // 次の戦略へ
  }

  // 戦略2: ```json ... ``` コードブロックから抽出
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (parsed !== null && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // 次の戦略へ
    }
  }

  // 戦略3: 最初の { から最後の } までを抽出
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.substring(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed !== null && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // 次の戦略へ
    }
  }

  // 戦略4: 全ての { } ブロックを探して最大のものを試行
  const braceBlocks = findBalancedBraces(trimmed);
  for (const block of braceBlocks) {
    try {
      const parsed = JSON.parse(block);
      if (parsed !== null && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * テキスト中のバランスの取れた波括弧ブロックを見つける（大きい順にソート）。
 */
function findBalancedBraces(text: string): string[] {
  const blocks: string[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        blocks.push(text.substring(start, i + 1));
        start = -1;
      }
    }
  }

  // 大きいブロック（情報が多い）を優先
  blocks.sort((a, b) => b.length - a.length);
  return blocks;
}

/**
 * パースされたJSONからParsedOrderに変換する。
 * 不足フィールドにはデフォルト値を設定する。
 */
function toParsedOrder(parsed: Record<string, unknown>, source: EmailSource): ParsedOrder {
  return {
    orderDate: typeof parsed.orderDate === "string" ? parsed.orderDate : "",
    orderNumber: typeof parsed.orderNumber === "string" ? parsed.orderNumber : "",
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
    receiptUrl: typeof parsed.receiptUrl === "string" ? sanitizeReceiptUrl(parsed.receiptUrl) : "",
    source,
  };
}

/**
 * Geminiが抽出した領収書URLから不要なパラメータを除去する。
 * Amazon メール内のURLには ie=UTF8 等のパラメータが含まれていることがあり、
 * そのままだとページが開けない場合がある。
 */
function sanitizeReceiptUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    // ie=UTF8 パラメータを除去
    parsed.searchParams.delete("ie");
    // ref_ パラメータを除去（トラッキング用、ページ表示に不要）
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("ref_")) {
        parsed.searchParams.delete(key);
      }
    }
    // referrer パラメータを除去
    parsed.searchParams.delete("referrer");
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function analyzeEmailWithGemini(
  emailHtml: string,
  apiKey: string,
  source: EmailSource = "amazon",
  subject?: string
): Promise<ParsedOrder | null> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const truncatedHtml =
    emailHtml.length > 30000 ? emailHtml.substring(0, 30000) : emailHtml;

  const prompt = getPromptForSource(source);
  const subjectLine = subject ? `\nメール件名: ${subject}\n` : "";
  const result = await withRetry(
    () => model.generateContent(prompt + subjectLine + "\nメール本文:\n" + truncatedHtml),
    {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      onRetry: (attempt, error, delayMs) => {
        console.warn(
          `[Gemini] リトライ ${attempt}/3 (${delayMs}ms後): ${error instanceof Error ? error.message : String(error)}`
        );
      },
    }
  );

  const response = result.response;
  const text = response.text();

  // Gemini API 使用量をメトリクスに記録
  const usageMetadata = response.usageMetadata;
  if (usageMetadata) {
    const inputTokens = usageMetadata.promptTokenCount ?? 0;
    const outputTokens = usageMetadata.candidatesTokenCount ?? 0;
    const totalTokens = usageMetadata.totalTokenCount ?? 0;
    metrics.recordGeminiUsage({ inputTokens, outputTokens, totalTokens });
    logger.debug("Gemini API usage recorded", { inputTokens, outputTokens, totalTokens });
  }

  const extracted = extractJsonFromResponse(text);
  if (!extracted) {
    return null;
  }

  try {
    return toParsedOrder(extracted as Record<string, unknown>, source);
  } catch {
    return null;
  }
}

/**
 * 複数メールを一括解析する。部分的な失敗があっても他のメールは処理を継続する。
 */
export interface BatchAnalysisResult {
  emailId: string;
  order: ParsedOrder | null;
  error?: string;
  errorCode?: string;
}

export async function analyzeEmailsBatch(
  emails: Array<{ id: string; body: string; subject?: string }>,
  apiKey: string,
  source: EmailSource = "amazon"
): Promise<{
  results: BatchAnalysisResult[];
  successCount: number;
  failureCount: number;
}> {
  const results: BatchAnalysisResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const email of emails) {
    try {
      const order = await analyzeEmailWithGemini(email.body, apiKey, source, email.subject);
      if (order) {
        results.push({ emailId: email.id, order });
        successCount++;
      } else {
        results.push({
          emailId: email.id,
          order: null,
          error: "メールから注文情報を抽出できませんでした",
          errorCode: "GEMINI_PARSE_FAILED",
        });
        failureCount++;
      }
    } catch (error) {
      const message =
        error instanceof AppError
          ? error.userMessage
          : error instanceof Error
            ? error.message
            : "不明なエラー";

      results.push({
        emailId: email.id,
        order: null,
        error: `メール解析に失敗しました: ${message}`,
        errorCode:
          error instanceof AppError ? error.code : "GEMINI_API_FAILED",
      });
      failureCount++;
    }
  }

  return { results, successCount, failureCount };
}
