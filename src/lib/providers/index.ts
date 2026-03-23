import { EmailSource } from "../types";
import { EmailProvider } from "./types";
import { AmazonProvider } from "./amazon";

const providers = new Map<EmailSource, EmailProvider>();
providers.set("amazon", new AmazonProvider());

export function getProvider(source: EmailSource): EmailProvider {
  const provider = providers.get(source);
  if (!provider) {
    throw new Error(`Unknown provider: ${source}`);
  }
  return provider;
}

export { EmailProvider, GetEmailsOptions, GetEmailsResult, GmailDateFilter } from "./types";
export { AmazonRegion } from "./amazon";
