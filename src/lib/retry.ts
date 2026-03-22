/**
 * 汎用リトライユーティリティ（指数バックオフ + ジッター）
 */

/** リトライ可能と判定されたエラーかどうかを示すインターフェース */
interface RetryableErrorInfo {
  retryable: boolean;
  reason: string;
}

export interface RetryOptions {
  /** 最大リトライ回数（初回を含まない） */
  maxRetries: number;
  /** 初回リトライ時の基本待機時間（ミリ秒） */
  baseDelayMs: number;
  /** 最大待機時間（ミリ秒） */
  maxDelayMs: number;
  /** リトライ時に呼ばれるコールバック（ログ用） */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * エラーがリトライ可能かどうかを判定する。
 *
 * リトライ対象:
 * - HTTP 5xx サーバーエラー
 * - HTTP 429 レート制限
 * - ネットワークエラー（fetch failure, ECONNRESET 等）
 */
export function isRetryableError(error: unknown): RetryableErrorInfo {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // ネットワーク関連エラー
    const networkPatterns = [
      "econnreset",
      "econnrefused",
      "etimedout",
      "enotfound",
      "epipe",
      "fetch failed",
      "network",
      "socket hang up",
      "aborted",
    ];
    for (const pattern of networkPatterns) {
      if (message.includes(pattern)) {
        return { retryable: true, reason: `network error: ${pattern}` };
      }
    }

    // Google API エラー（status code がメッセージに含まれるケース）
    const statusMatch = message.match(/(\d{3})/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      if (status >= 500 && status <= 599) {
        return { retryable: true, reason: `server error: ${status}` };
      }
      if (status === 429) {
        return { retryable: true, reason: "rate limited: 429" };
      }
    }

    // Google API の GaxiosError にはステータスコードがプロパティとしてある場合
    const errorWithCode = error as Error & {
      code?: number | string;
      status?: number;
      response?: { status?: number };
    };

    const statusCode =
      errorWithCode.status ??
      errorWithCode.response?.status ??
      (typeof errorWithCode.code === "number" ? errorWithCode.code : undefined);

    if (typeof statusCode === "number") {
      if (statusCode >= 500 && statusCode <= 599) {
        return { retryable: true, reason: `server error: ${statusCode}` };
      }
      if (statusCode === 429) {
        return { retryable: true, reason: "rate limited: 429" };
      }
    }
  }

  return { retryable: false, reason: "not retryable" };
}

/**
 * ジッター付き指数バックオフの待機時間を計算する。
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  // 指数バックオフ: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  // ジッター: 0.5〜1.5 の範囲でランダム化
  const jitter = 0.5 + Math.random();
  return Math.min(exponentialDelay * jitter, maxDelayMs);
}

/**
 * 指定された非同期関数をリトライ付きで実行する。
 *
 * @param fn - 実行する非同期関数
 * @param options - リトライオプション（省略時はデフォルト値を使用）
 * @returns fn の戻り値
 * @throws 最大リトライ回数を超えた場合、最後のエラーをスロー
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 最後の試行の場合はリトライしない
      if (attempt >= opts.maxRetries) {
        break;
      }

      const { retryable } = isRetryableError(error);
      if (!retryable) {
        throw error;
      }

      const delayMs = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);

      if (opts.onRetry) {
        opts.onRetry(attempt + 1, error, delayMs);
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
