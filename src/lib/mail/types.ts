import type { MailFolder, Mailbox } from "@prisma/client";

export type OutgoingMessage = {
  messageId: string;
  inReplyTo?: string | null;
  from: string;
  fromName?: string | null;
  to: string;
  subject: string;
  body: string;
};

export type RemoteMessage = {
  folder: MailFolder;
  messageId: string;
  inReplyTo?: string | null;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: Date;
  uid: number;
};

export type FetchResult = {
  messages: RemoteMessage[];
  // Every Message-ID currently in the remote Drafts folder, so drafts removed
  // in the mail client can be removed here too.
  draftIds: Set<string>;
};

// Every mailbox backend implements this. Add Gmail API / Microsoft Graph
// adapters here later without touching the workflow code.
export interface MailAdapter {
  saveDraft(mailbox: Mailbox, msg: OutgoingMessage): Promise<{ uid?: number }>;
  deleteDraft(mailbox: Mailbox, messageId: string): Promise<void>;
  send(mailbox: Mailbox, msg: OutgoingMessage): Promise<void>;
  fetch(mailbox: Mailbox, since: Date): Promise<FetchResult | null>;
  test(mailbox: Mailbox): Promise<void>;
}
