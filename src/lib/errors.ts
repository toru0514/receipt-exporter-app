/**
 * ユーザー向けエラーメッセージのマッピングとアプリケーションエラー定義
 */

/** アプリケーションエラーの種別 */
export type AppErrorCode =
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "GMAIL_FETCH_FAILED"
  | "GEMINI_API_FAILED"
  | "GEMINI_PARSE_FAILED"
  | "SHEETS_EXPORT_FAILED"
  | "SHEETS_CREATE_FAILED"
  | "INVALID_INPUT"
  | "NETWORK_ERROR"
  | "INTERNAL_ERROR";

interface AppErrorInfo {
  /** HTTP ステータスコード */
  statusCode: number;
  /** ユーザーに表示するメッセージ */
  userMessage: string;
}

const ERROR_MAP: Record<AppErrorCode, AppErrorInfo> = {
  UNAUTHORIZED: {
    statusCode: 401,
    userMessage: "認証が必要です。再度ログインしてください。",
  },
  RATE_LIMITED: {
    statusCode: 429,
    userMessage: "リクエストが多すぎます。しばらく待ってから再試行してください。",
  },
  GMAIL_FETCH_FAILED: {
    statusCode: 502,
    userMessage:
      "メールの取得に失敗しました。Googleアカウントの接続を確認し、再試行してください。",
  },
  GEMINI_API_FAILED: {
    statusCode: 502,
    userMessage:
      "メール解析サービスに一時的な問題が発生しています。しばらく待ってから再試行してください。",
  },
  GEMINI_PARSE_FAILED: {
    statusCode: 422,
    userMessage:
      "メールの内容を解析できませんでした。Amazon注文確認メールであることを確認してください。",
  },
  SHEETS_EXPORT_FAILED: {
    statusCode: 502,
    userMessage:
      "スプレッドシートへの書き込みに失敗しました。スプレッドシートへのアクセス権限を確認してください。",
  },
  SHEETS_CREATE_FAILED: {
    statusCode: 502,
    userMessage:
      "スプレッドシートの作成に失敗しました。Google Driveへのアクセス権限を確認してください。",
  },
  INVALID_INPUT: {
    statusCode: 400,
    userMessage: "入力データが不正です。リクエスト内容を確認してください。",
  },
  NETWORK_ERROR: {
    statusCode: 503,
    userMessage:
      "外部サービスとの通信に失敗しました。ネットワーク接続を確認し、再試行してください。",
  },
  INTERNAL_ERROR: {
    statusCode: 500,
    userMessage: "予期しないエラーが発生しました。しばらく待ってから再試行してください。",
  },
};

/**
 * アプリケーション固有のエラークラス。
 * エラー種別に基づいてユーザーフレンドリーなメッセージと HTTP ステータスを提供する。
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;
  readonly userMessage: string;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, cause?: unknown, detailMessage?: string) {
    const info = ERROR_MAP[code];
    const message = detailMessage ?? info.userMessage;
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = info.statusCode;
    this.userMessage = info.userMessage;
    this.cause = cause;
  }
}

/**
 * 任意のエラーから AppError を生成する。
 * 既に AppError の場合はそのまま返す。
 * それ以外の場合はエラー内容からエラー種別を推定する。
 */
export function toAppError(error: unknown, defaultCode: AppErrorCode): AppError {
  if (error instanceof AppError) {
    return error;
  }

  // ネットワーク系エラーの判定
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const networkPatterns = [
      "econnreset",
      "econnrefused",
      "etimedout",
      "fetch failed",
      "network",
    ];
    for (const pattern of networkPatterns) {
      if (msg.includes(pattern)) {
        return new AppError("NETWORK_ERROR", error);
      }
    }
  }

  return new AppError(defaultCode, error);
}

/**
 * AppError から API レスポンス用の JSON ボディを生成する。
 */
export function errorToResponse(error: AppError): {
  body: { error: string; code: AppErrorCode };
  status: number;
} {
  return {
    body: {
      error: error.userMessage,
      code: error.code,
    },
    status: error.statusCode,
  };
}
