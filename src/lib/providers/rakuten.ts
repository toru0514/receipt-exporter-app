import { fetchAndParseEmails } from "../gmail";
import { EmailProvider, GetEmailsOptions, GetEmailsResult } from "./types";

const RAKUTEN_SENDERS = ["order@rakuten.co.jp"];

export class RakutenProvider implements EmailProvider {
  readonly source = "rakuten" as const;

  buildQuery(options: GetEmailsOptions): string {
    const fromConditions = RAKUTEN_SENDERS.map((s) => `from:${s}`).join(" OR ");
    const forwardedCondition = "subject:fwd 楽天市場 注文内容ご確認";

    let query = `(${fromConditions} OR (${forwardedCondition}))`;

    if (options.dateFilter?.after) {
      query += ` after:${options.dateFilter.after.replace(/-/g, "/")}`;
    }
    if (options.dateFilter?.before) {
      query += ` before:${options.dateFilter.before.replace(/-/g, "/")}`;
    }

    return query;
  }

  async getEmails(accessToken: string, options: GetEmailsOptions): Promise<GetEmailsResult> {
    const query = this.buildQuery(options);
    return fetchAndParseEmails(accessToken, query, this.source, options);
  }

  getDefaultReceiptUrl(_orderNumber: string): string {
    return "https://order.my.rakuten.co.jp/";
  }
}
