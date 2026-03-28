/**
 * 定期実行ジョブ: メール自動取得・解析
 *
 * Vercel Cron や外部 cron サービスから /api/cron エンドポイント経由で呼び出される。
 * OAuth トークンが必要なため、実行にはアクティブなセッション（refreshToken）が必要。
 */

import { getProvider } from "./providers";
import { analyzeEmailsBatch, BatchAnalysisResult } from "./gemini";
import { logger } from "./logger";

const log = logger.child({ module: "scheduled-job" });

export interface ScheduledJobResult {
  /** ジョブの実行ステータス */
  status: "success" | "partial" | "error";
  /** 取得したメール数 */
  emailsFetched: number;
  /** 解析成功数 */
  analysisSuccess: number;
  /** 解析失敗数 */
  analysisFailure: number;
  /** 解析結果の詳細 */
  results: BatchAnalysisResult[];
  /** エラーメッセージ（エラー時のみ） */
  error?: string;
  /** 実行時間（ミリ秒） */
  durationMs: number;
}

export interface ScheduledJobOptions {
  /** Gmail アクセストークン */
  accessToken: string;
  /** Gemini API キー */
  geminiApiKey: string;
  /** 取得するメール数（デフォルト: 10） */
  maxEmails?: number;
}

/**
 * 定期実行ジョブのメインロジック。
 *
 * 1. Gmail から Amazon 注文確認メールを取得
 * 2. Gemini API でメール本文を解析
 * 3. 結果を返す（呼び出し元で Sheets 出力等を行う）
 */
export async function runScheduledJob(
  options: ScheduledJobOptions
): Promise<ScheduledJobResult> {
  const startTime = Date.now();
  const { accessToken, geminiApiKey, maxEmails = 10 } = options;

  log.info("Scheduled job started", { maxEmails });

  try {
    // Step 1: Gmail からメール取得
    log.info("Fetching Amazon emails from Gmail");
    const provider = getProvider("amazon");
    const { emails } = await provider.getEmails(accessToken, { maxResults: maxEmails });

    if (emails.length === 0) {
      log.info("No Amazon emails found");
      return {
        status: "success",
        emailsFetched: 0,
        analysisSuccess: 0,
        analysisFailure: 0,
        results: [],
        durationMs: Date.now() - startTime,
      };
    }

    log.info("Emails fetched", { count: emails.length });

    // Step 2: Gemini API でメール解析
    log.info("Starting batch email analysis");
    const emailsForAnalysis = emails.map((email) => ({
      id: email.id,
      body: email.body,
    }));

    const batchResult = await analyzeEmailsBatch(emailsForAnalysis, geminiApiKey);

    const durationMs = Date.now() - startTime;
    const status =
      batchResult.failureCount === 0
        ? "success"
        : batchResult.successCount > 0
          ? "partial"
          : "error";

    log.info("Scheduled job completed", {
      status,
      emailsFetched: emails.length,
      analysisSuccess: batchResult.successCount,
      analysisFailure: batchResult.failureCount,
      durationMs,
    });

    return {
      status,
      emailsFetched: emails.length,
      analysisSuccess: batchResult.successCount,
      analysisFailure: batchResult.failureCount,
      results: batchResult.results,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);

    log.error("Scheduled job failed", { error: message, durationMs });

    return {
      status: "error",
      emailsFetched: 0,
      analysisSuccess: 0,
      analysisFailure: 0,
      results: [],
      error: message,
      durationMs,
    };
  }
}
