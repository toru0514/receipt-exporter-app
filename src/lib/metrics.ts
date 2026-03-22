/**
 * インメモリ メトリクス収集ユーティリティ
 *
 * リクエスト数、成功/失敗数、レスポンスタイム（平均、P95）を収集する。
 * Gemini API 使用量の記録にも対応。
 */

interface EndpointMetrics {
  /** 総リクエスト数 */
  totalRequests: number;
  /** 成功数 */
  successCount: number;
  /** 失敗数 */
  failureCount: number;
  /** レスポンスタイム（ms）の記録。直近 1000 件を保持 */
  responseTimes: number[];
}

interface GeminiUsageEntry {
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface GeminiMetricsSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
}

export interface MetricsSummary {
  endpoints: Record<string, {
    totalRequests: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    avgResponseTimeMs: number;
    p95ResponseTimeMs: number;
  }>;
  gemini: GeminiMetricsSummary;
  uptime: number;
  collectedAt: string;
}

const MAX_RESPONSE_TIMES = 1000;
const MAX_GEMINI_ENTRIES = 500;

const endpointStore = new Map<string, EndpointMetrics>();
const geminiUsageLog: GeminiUsageEntry[] = [];
const startTime = Date.now();

function getOrCreateEndpoint(endpoint: string): EndpointMetrics {
  let m = endpointStore.get(endpoint);
  if (!m) {
    m = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      responseTimes: [],
    };
    endpointStore.set(endpoint, m);
  }
  return m;
}

function calculateP95(times: number[]): number {
  if (times.length === 0) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(idx, 0)];
}

function calculateAvg(times: number[]): number {
  if (times.length === 0) return 0;
  const sum = times.reduce((a, b) => a + b, 0);
  return Math.round(sum / times.length);
}

export const metrics = {
  /**
   * リクエスト開始を記録し、終了時に呼ぶ関数を返す。
   */
  startRequest(endpoint: string): () => void {
    const start = Date.now();
    const m = getOrCreateEndpoint(endpoint);
    m.totalRequests++;

    return () => {
      const elapsed = Date.now() - start;
      m.responseTimes.push(elapsed);
      if (m.responseTimes.length > MAX_RESPONSE_TIMES) {
        m.responseTimes.shift();
      }
    };
  },

  /**
   * 成功を記録する。
   */
  recordSuccess(endpoint: string): void {
    const m = getOrCreateEndpoint(endpoint);
    m.successCount++;
  },

  /**
   * 失敗を記録する。
   */
  recordFailure(endpoint: string): void {
    const m = getOrCreateEndpoint(endpoint);
    m.failureCount++;
  },

  /**
   * Gemini API の使用量を記録する。
   */
  recordGeminiUsage(usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }): void {
    geminiUsageLog.push({
      timestamp: Date.now(),
      ...usage,
    });
    if (geminiUsageLog.length > MAX_GEMINI_ENTRIES) {
      geminiUsageLog.shift();
    }
  },

  /**
   * 全メトリクスのサマリーを返す。
   */
  getSummary(): MetricsSummary {
    const endpoints: MetricsSummary["endpoints"] = {};
    for (const [name, m] of endpointStore.entries()) {
      const total = m.successCount + m.failureCount;
      endpoints[name] = {
        totalRequests: m.totalRequests,
        successCount: m.successCount,
        failureCount: m.failureCount,
        successRate: total > 0 ? Math.round((m.successCount / total) * 10000) / 100 : 100,
        avgResponseTimeMs: calculateAvg(m.responseTimes),
        p95ResponseTimeMs: calculateP95(m.responseTimes),
      };
    }

    const geminiSummary: GeminiMetricsSummary = {
      totalRequests: geminiUsageLog.length,
      totalInputTokens: geminiUsageLog.reduce((s, e) => s + e.inputTokens, 0),
      totalOutputTokens: geminiUsageLog.reduce((s, e) => s + e.outputTokens, 0),
      totalTokens: geminiUsageLog.reduce((s, e) => s + e.totalTokens, 0),
    };

    return {
      endpoints,
      gemini: geminiSummary,
      uptime: Math.round((Date.now() - startTime) / 1000),
      collectedAt: new Date().toISOString(),
    };
  },

  /**
   * メトリクスをリセットする（テスト用）。
   */
  reset(): void {
    endpointStore.clear();
    geminiUsageLog.length = 0;
  },
};
