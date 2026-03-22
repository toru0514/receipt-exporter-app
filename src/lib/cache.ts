/**
 * インメモリ キャッシュユーティリティ（Map + TTL）
 *
 * サーバーレス環境ではインスタンスごとに状態が分離される点に注意。
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  /**
   * @param ttlMs キャッシュの有効期間（ミリ秒）。デフォルト 10 分。
   * @param maxSize キャッシュの最大エントリ数。デフォルト 500。
   */
  constructor(ttlMs: number = 10 * 60 * 1000, maxSize: number = 500) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    // maxSize を超えた場合、期限切れエントリを先に削除
    if (this.store.size >= this.maxSize) {
      this.evictExpired();
    }

    // それでも超えている場合、最も古いエントリを削除
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.store.delete(firstKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
