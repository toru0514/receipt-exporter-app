import { EmailSource } from "../types";
import { EmailProvider } from "./types";
import { AmazonProvider } from "./amazon";
import { RakutenProvider } from "./rakuten";

const providers = new Map<EmailSource, EmailProvider>();
providers.set("amazon", new AmazonProvider());
providers.set("rakuten", new RakutenProvider());

export function getProvider(source: EmailSource): EmailProvider {
  const provider = providers.get(source);
  if (!provider) {
    throw new Error(`Unknown provider: ${source}`);
  }
  return provider;
}

export type { EmailProvider, GetEmailsOptions, GetEmailsResult, GmailDateFilter } from "./types";
export type { AmazonRegion } from "./amazon";
