/**
 * 構造化ログ ユーティリティ
 *
 * JSON形式の構造化ログを出力する。
 * 外部パッケージ不要のシンプルな実装。
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLogLevel(): LogLevel {
  const env = process.env.LOG_LEVEL;
  if (env && env in LOG_LEVEL_PRIORITY) {
    return env as LogLevel;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[getMinLogLevel()];
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context !== undefined && Object.keys(context).length > 0) {
    entry.context = context;
  }

  const output = formatEntry(entry);

  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    default:
      console.log(output);
      break;
  }
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    log("debug", message, context);
  },
  info(message: string, context?: Record<string, unknown>): void {
    log("info", message, context);
  },
  warn(message: string, context?: Record<string, unknown>): void {
    log("warn", message, context);
  },
  error(message: string, context?: Record<string, unknown>): void {
    log("error", message, context);
  },

  /**
   * 子ロガーを作成する。指定した baseContext が全てのログに付与される。
   */
  child(baseContext: Record<string, unknown>) {
    return {
      debug(message: string, context?: Record<string, unknown>): void {
        log("debug", message, { ...baseContext, ...context });
      },
      info(message: string, context?: Record<string, unknown>): void {
        log("info", message, { ...baseContext, ...context });
      },
      warn(message: string, context?: Record<string, unknown>): void {
        log("warn", message, { ...baseContext, ...context });
      },
      error(message: string, context?: Record<string, unknown>): void {
        log("error", message, { ...baseContext, ...context });
      },
    };
  },
};
