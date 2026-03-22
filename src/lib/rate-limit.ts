/**
 * インメモリ レート制限ユーティリティ
 *
 * スライディングウィンドウ方式でリクエスト数を制限する。
 * サーバーレス環境ではインスタンスごとに状態が分離される点に注意。
 */

interface RateLimitEntry {
  /** リクエストタイムスタンプの配列 */
  timestamps: number[];
}

interface RateLimitOptions {
  /** ウィンドウ期間（ミリ秒） */
  windowMs: number;
  /** ウィンドウ内の最大リクエスト数 */
  maxRequests: number;
}

interface RateLimitResult {
  /** リクエストが許可されたかどうか */
  allowed: boolean;
  /** 残りリクエスト数 */
  remaining: number;
  /** リセットまでのミリ秒 */
  retryAfterMs: number;
}

const store = new Map<string, RateLimitEntry>();

/** 古いエントリを定期的にクリーンアップする間隔（5 分） */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

/**
 * レート制限チェックを実行する。
 *
 * @param key - 識別キー（例: `${endpoint}:${userId}`）
 * @param options - レート制限設定
 * @returns チェック結果
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { windowMs, maxRequests } = options;
  const now = Date.now();

  cleanup(windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // ウィンドウ外のタイムスタンプを除去
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(retryAfterMs, 0),
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  };
}
