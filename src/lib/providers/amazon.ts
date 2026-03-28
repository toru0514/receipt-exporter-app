import { fetchAndParseEmails } from "../gmail";
import { EmailProvider, GetEmailsOptions, GetEmailsResult } from "./types";

const AMAZON_SENDERS_JP = [
  "auto-confirm@amazon.co.jp",
  "shipment-tracking@amazon.co.jp",
];

const AMAZON_SENDERS_US = [
  "auto-confirm@amazon.com",
  "shipment-tracking@amazon.com",
];

export type AmazonRegion = "jp" | "us" | "all";

function getSendersForRegion(region: AmazonRegion): string[] {
  switch (region) {
    case "jp":
      return AMAZON_SENDERS_JP;
    case "us":
      return AMAZON_SENDERS_US;
    case "all":
      return [...AMAZON_SENDERS_JP, ...AMAZON_SENDERS_US];
  }
}

export class AmazonProvider implements EmailProvider {
  readonly source = "amazon" as const;

  buildQuery(options: GetEmailsOptions): string {
    const region = (options.region as AmazonRegion) || "jp";
    const senders = getSendersForRegion(region);
    const fromConditions = senders.map((s) => `from:${s}`).join(" OR ");

    const forwardedCondition =
      region === "us"
        ? "subject:fwd subject:shipped amazon.com"
        : region === "jp"
          ? "subject:fwd subject:発送済み amazon.co.jp"
          : "subject:fwd (subject:発送済み OR subject:shipped) (amazon.co.jp OR amazon.com)";

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

  getDefaultReceiptUrl(orderNumber: string): string {
    return `https://www.amazon.co.jp/gp/your-account/order-details?orderID=${orderNumber}`;
  }
}
