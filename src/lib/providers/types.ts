import { OrderEmail, EmailSource } from "../types";

export interface GmailDateFilter {
  after?: string;
  before?: string;
}

export interface GetEmailsOptions {
  maxResults?: number;
  pageToken?: string;
  dateFilter?: GmailDateFilter;
  /** Amazon専用: リージョン選択 */
  region?: string;
}

export interface GetEmailsResult {
  emails: OrderEmail[];
  nextPageToken?: string;
}

export interface EmailProvider {
  readonly source: EmailSource;
  buildQuery(options: GetEmailsOptions): string;
  getEmails(accessToken: string, options: GetEmailsOptions): Promise<GetEmailsResult>;
  getDefaultReceiptUrl(orderNumber: string): string;
}
