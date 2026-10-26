import type { Mailbox } from "@prisma/client";
import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { decrypt } from "../crypto";
import type { FetchResult, MailAdapter, OutgoingMessage, RemoteMessage } from "./types";

const FETCH_LIMIT = 200;

function password(mailbox: Mailbox) {
  if (!mailbox.passwordEnc) throw new Error("Mailbox has no password saved");
  return decrypt(mailbox.passwordEnc);
}

function imapClient(mailbox: Mailbox) {
  if (!mailbox.imapHost) throw new Error("IMAP host is missing");
  const port = mailbox.imapPort ?? 993;
  return new ImapFlow({
    host: mailbox.imapHost,
    port,
    secure: port === 993,
    auth: { user: mailbox.username || mailbox.address, pass: password(mailbox) },
    logger: false,
  });
}

function smtpTransport(mailbox: Mailbox) {
  if (!mailbox.smtpHost) throw new Error("SMTP host is missing");
  const port = mailbox.smtpPort ?? 465;
  return nodemailer.createTransport({
    host: mailbox.smtpHost,
    port,
    secure: port === 465,
    auth: { user: mailbox.username || mailbox.address, pass: password(mailbox) },
  });
}

function mailOptions(msg: OutgoingMessage) {
  return {
    messageId: msg.messageId,
    inReplyTo: msg.inReplyTo ?? undefined,
    references: msg.inReplyTo ?? undefined,
    from: msg.fromName ? { name: msg.fromName, address: msg.from } : msg.from,
    to: msg.to,
    subject: msg.subject,
    text: msg.body,
  };
}

async function buildRaw(msg: OutgoingMessage): Promise<Buffer> {
  return new MailComposer(mailOptions(msg)).compile().build();
}

async function folderPath(client: ImapFlow, mailbox: Mailbox, use: "\\Sent" | "\\Drafts") {
  const override = use === "\\Sent" ? mailbox.sentFolder : mailbox.draftsFolder;
  if (override) return override;
  const list = await client.list();
  const found = list.find((f) => f.specialUse === use);
  if (found) return found.path;
  const name = use === "\\Sent" ? /^(sent|sent items|sent mail)$/i : /^drafts?$/i;
  return list.find((f) => name.test(f.name))?.path ?? (use === "\\Sent" ? "Sent" : "Drafts");
}

async function withClient<T>(mailbox: Mailbox, fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const client = imapClient(mailbox);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

function addressText(a: AddressObject | AddressObject[] | undefined) {
  const first = Array.isArray(a) ? a[0] : a;
  return first?.value?.[0]?.address?.toLowerCase() ?? "";
}

export const imapAdapter: MailAdapter = {
  async saveDraft(mailbox, msg) {
    const raw = await buildRaw(msg);
    return withClient(mailbox, async (client) => {
      const path = await folderPath(client, mailbox, "\\Drafts");
      const res = await client.append(path, raw, ["\\Draft", "\\Seen"]);
      return { uid: res && typeof res === "object" ? res.uid : undefined };
    });
  },

  async deleteDraft(mailbox, messageId) {
    await withClient(mailbox, async (client) => {
      const path = await folderPath(client, mailbox, "\\Drafts");
      const lock = await client.getMailboxLock(path);
      try {
        const uids = await client.search({ header: { "message-id": messageId } }, { uid: true });
        if (uids && uids.length) await client.messageDelete(uids, { uid: true });
      } finally {
        lock.release();
      }
    });
  },

  async send(mailbox, msg) {
    await smtpTransport(mailbox).sendMail(mailOptions(msg));
    // Gmail stores SMTP-sent mail in Sent by itself; most other hosts don't.
    if (!/gmail\.com$/i.test(mailbox.smtpHost ?? "")) {
      const raw = await buildRaw(msg);
      await withClient(mailbox, async (client) => {
        const path = await folderPath(client, mailbox, "\\Sent");
        await client.append(path, raw, ["\\Seen"]);
      });
    }
  },

  async fetch(mailbox, since): Promise<FetchResult> {
    return withClient(mailbox, async (client) => {
      const folders = [
        { folder: "INBOX" as const, path: "INBOX" },
        { folder: "SENT" as const, path: await folderPath(client, mailbox, "\\Sent") },
        { folder: "DRAFT" as const, path: await folderPath(client, mailbox, "\\Drafts") },
      ];
      const messages: RemoteMessage[] = [];
      const draftIds = new Set<string>();

      for (const { folder, path } of folders) {
        let lock;
        try {
          lock = await client.getMailboxLock(path);
        } catch {
          continue; // folder doesn't exist on this server
        }
        try {
          // Drafts are always read in full so deletions can be mirrored.
          const query = folder === "DRAFT" ? { all: true } : { since };
          const found = await client.search(query, { uid: true });
          const uids = (found || []).slice(-FETCH_LIMIT);
          if (!uids.length) continue;
          for await (const m of client.fetch(uids, { uid: true, source: true }, { uid: true })) {
            if (!m.source) continue;
            const parsed = await simpleParser(m.source);
            const messageId = parsed.messageId || `<uid-${folder}-${m.uid}@${mailbox.address}>`;
            if (folder === "DRAFT") draftIds.add(messageId);
            messages.push({
              folder,
              messageId,
              inReplyTo: parsed.inReplyTo ?? null,
              from: addressText(parsed.from),
              to: addressText(parsed.to),
              subject: parsed.subject ?? "(no subject)",
              body: parsed.text ?? "",
              date: parsed.date ?? new Date(),
              uid: m.uid,
            });
          }
        } finally {
          lock.release();
        }
      }
      return { messages, draftIds };
    });
  },

  async test(mailbox) {
    await withClient(mailbox, async (client) => {
      await client.list();
    });
    await smtpTransport(mailbox).verify();
  },
};
