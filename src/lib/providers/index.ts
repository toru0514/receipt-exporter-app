import { EmailSource } from "../types";
import { EmailProvider } from "./types";

const providers = new Map<EmailSource, EmailProvider>();

export function getProvider(source: EmailSource): EmailProvider {
  const provider = providers.get(source);
  if (!provider) {
    throw new Error(`Unknown provider: ${source}`);
  }
  return provider;
}

export function registerProvider(provider: EmailProvider): void {
  providers.set(provider.source, provider);
}

export { EmailProvider, GetEmailsOptions, GetEmailsResult, GmailDateFilter } from "./types";
