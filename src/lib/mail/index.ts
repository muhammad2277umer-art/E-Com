import type { Mailbox } from "@prisma/client";
import { demoAdapter } from "./demo";
import { imapAdapter } from "./imap";
import type { MailAdapter } from "./types";

export function adapterFor(mailbox: Mailbox): MailAdapter {
  switch (mailbox.provider) {
    case "IMAP":
      return imapAdapter;
    case "DEMO":
    default:
      return demoAdapter;
  }
}
