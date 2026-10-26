import type { MailAdapter } from "./types";

// Demo mailboxes live only in this app's database. Useful for trying the
// workflow before connecting a real mailbox.
export const demoAdapter: MailAdapter = {
  async saveDraft() {
    return {};
  },
  async deleteDraft() {},
  async send() {},
  async fetch() {
    return null;
  },
  async test() {},
};
