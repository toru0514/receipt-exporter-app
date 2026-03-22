/**
 * エラートラッキング ユーティリティ（Sentry準備）
 *
 * 現時点では console.error へのフォールバック実装。
 * 環境変数 SENTRY_DSN が設定されている場合のみ有効化する想定。
 * 将来 Sentry SDK を導入した際に差し替え可能なインターフェース。
 */

import { logger } from "./logger";

export interface ErrorContext {
  /** エラーが発生した機能領域 */
  module?: string;
  /** ユーザー識別子（ハッシュ等） */
  userId?: string;
  /** 追加のメタデータ */
  extra?: Record<string, unknown>;
  /** エラーの重要度 */
  severity?: "fatal" | "error" | "warning" | "info";
  /** タグ */
  tags?: Record<string, string>;
}

export interface ErrorTracker {
  /** エラーを報告する */
  captureException(error: unknown, context?: ErrorContext): void;
  /** メッセージを報告する */
  captureMessage(message: string, context?: ErrorContext): void;
  /** Sentry が有効かどうか */
  isEnabled(): boolean;
}

function isSentryConfigured(): boolean {
  return typeof process.env.SENTRY_DSN === "string" && process.env.SENTRY_DSN.length > 0;
}

function formatError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

/**
 * フォールバック実装: console.error + 構造化ログ へ出力
 */
const fallbackTracker: ErrorTracker = {
  captureException(error: unknown, context?: ErrorContext): void {
    const errorInfo = formatError(error);
    logger.error("Captured exception", {
      error: errorInfo.message,
      stack: errorInfo.stack,
      ...context?.extra,
      module: context?.module,
      severity: context?.severity ?? "error",
      tags: context?.tags,
    });
  },

  captureMessage(message: string, context?: ErrorContext): void {
    logger.warn("Captured message", {
      message,
      ...context?.extra,
      module: context?.module,
      severity: context?.severity ?? "info",
      tags: context?.tags,
    });
  },

  isEnabled(): boolean {
    return false;
  },
};

/**
 * Sentry準備用のスタブ実装。
 * SENTRY_DSN が設定されている場合でも、SDK が未導入のためフォールバックにルーティングする。
 * SDK 導入後はここを差し替える。
 */
const sentryStubTracker: ErrorTracker = {
  captureException(error: unknown, context?: ErrorContext): void {
    // TODO: Sentry SDK 導入後に Sentry.captureException() に差し替え
    const errorInfo = formatError(error);
    logger.error("[Sentry stub] Captured exception", {
      error: errorInfo.message,
      stack: errorInfo.stack,
      ...context?.extra,
      module: context?.module,
      severity: context?.severity ?? "error",
      tags: context?.tags,
    });
  },

  captureMessage(message: string, context?: ErrorContext): void {
    // TODO: Sentry SDK 導入後に Sentry.captureMessage() に差し替え
    logger.warn("[Sentry stub] Captured message", {
      message,
      ...context?.extra,
      module: context?.module,
      severity: context?.severity ?? "info",
      tags: context?.tags,
    });
  },

  isEnabled(): boolean {
    return true;
  },
};

/**
 * エラートラッカーのシングルトンインスタンス。
 * SENTRY_DSN が設定されていれば Sentry スタブ、なければフォールバック。
 */
export const errorTracker: ErrorTracker = isSentryConfigured()
  ? sentryStubTracker
  : fallbackTracker;
