import { randomUUID } from "crypto";
import type { Brand, EmailMessage, Mailbox, Prisma } from "@prisma/client";
import { db } from "./db";
import { FOLLOW_UP_AFTER_DAYS } from "./constants";
import { followUpDraft, outreachDraft } from "./drafts";
import { adapterFor } from "./mail";
import type { OutgoingMessage } from "./mail/types";

const DAY = 24 * 60 * 60 * 1000;

export function followUpCutoff(now = new Date()) {
  return new Date(now.getTime() - FOLLOW_UP_AFTER_DAYS * DAY);
}

// Brands that were emailed, haven't replied, were last emailed 3+ days ago,
// and don't already have a follow-up draft waiting.
export function followUpDueWhere(now = new Date()): Prisma.BrandWhereInput {
  return {
    status: "EMAILED",
    repliedAt: null,
    lastEmailedAt: { lte: followUpCutoff(now) },
    emails: { none: { folder: "DRAFT", kind: "FOLLOW_UP" } },
  };
}

export function isFollowUpDue(
  brand: Pick<Brand, "status" | "repliedAt" | "lastEmailedAt">,
  pendingFollowUps: number,
  now = new Date(),
) {
  return (
    brand.status === "EMAILED" &&
    !brand.repliedAt &&
    !!brand.lastEmailedAt &&
    brand.lastEmailedAt <= followUpCutoff(now) &&
    pendingFollowUps === 0
  );
}

function newMessageId(mailbox: Mailbox) {
  const domain = mailbox.address.split("@")[1] || "localhost";
  return `<${randomUUID()}@${domain}>`;
}

function toOutgoing(mailbox: Mailbox, m: EmailMessage): OutgoingMessage {
  return {
    messageId: m.messageId,
    inReplyTo: m.inReplyTo,
    from: mailbox.address,
    fromName: mailbox.displayName,
    to: m.toAddress,
    subject: m.subject,
    body: m.body,
  };
}

async function loadBrandForDraft(brandId: string) {
  const brand = await db.brand.findUniqueOrThrow({
    where: { id: brandId },
    include: { category: true, client: { include: { mailboxes: true } }, mailbox: true },
  });
  if (!brand.client) throw new Error("Link this brand to a client before writing a draft.");
  if (!brand.email) throw new Error("Add the brand's email address before writing a draft.");
  const mailbox = brand.mailbox ?? brand.client.mailboxes[0];
  if (!mailbox) throw new Error(`Add a mailbox to ${brand.client.name} before writing a draft.`);
  return { brand: { ...brand, client: brand.client }, mailbox };
}

async function storeDraft(mailbox: Mailbox, data: Omit<Prisma.EmailMessageUncheckedCreateInput, "mailboxId" | "folder" | "messageId" | "fromAddress">) {
  const messageId = newMessageId(mailbox);
  const draft = await db.emailMessage.create({
    data: { ...data, mailboxId: mailbox.id, folder: "DRAFT", messageId, fromAddress: mailbox.address },
  });
  const { uid } = await adapterFor(mailbox).saveDraft(mailbox, toOutgoing(mailbox, draft));
  if (uid) return db.emailMessage.update({ where: { id: draft.id }, data: { imapUid: uid } });
  return draft;
}

export async function writeOutreachDraft(brandId: string) {
  const { brand, mailbox } = await loadBrandForDraft(brandId);
  const content = await outreachDraft(brand, mailbox);
  return storeDraft(mailbox, {
    brandId: brand.id,
    kind: "OUTREACH",
    toAddress: brand.email!,
    subject: content.subject,
    body: content.body,
  });
}

export async function writeFollowUpDraft(brandId: string) {
  const { brand, mailbox } = await loadBrandForDraft(brandId);
  const pending = await db.emailMessage.count({ where: { brandId, folder: "DRAFT", kind: "FOLLOW_UP" } });
  if (!isFollowUpDue(brand, pending)) {
    throw new Error(
      `A follow-up is only available for Emailed brands with no reply ${FOLLOW_UP_AFTER_DAYS} days after the last email, and no follow-up draft already waiting.`,
    );
  }
  const lastSent = await db.emailMessage.findFirst({
    where: { brandId, folder: "SENT" },
    orderBy: { date: "desc" },
  });
  const content = await followUpDraft(brand, mailbox, lastSent ?? { subject: brand.name, body: "" });
  return storeDraft(mailbox, {
    brandId: brand.id,
    kind: "FOLLOW_UP",
    inReplyTo: lastSent?.messageId,
    toAddress: brand.email!,
    subject: content.subject,
    body: content.body,
  });
}

export async function updateDraft(id: string, data: { toAddress: string; subject: string; body: string }) {
  const draft = await db.emailMessage.findUniqueOrThrow({ where: { id }, include: { mailbox: true } });
  if (draft.folder !== "DRAFT") throw new Error("Only drafts can be edited.");
  const adapter = adapterFor(draft.mailbox);
  await adapter.deleteDraft(draft.mailbox, draft.messageId);
  const updated = await db.emailMessage.update({ where: { id }, data });
  const { uid } = await adapter.saveDraft(draft.mailbox, toOutgoing(draft.mailbox, updated));
  return uid ? db.emailMessage.update({ where: { id }, data: { imapUid: uid } }) : updated;
}

export async function deleteDraft(id: string) {
  const draft = await db.emailMessage.findUniqueOrThrow({ where: { id }, include: { mailbox: true } });
  if (draft.folder !== "DRAFT") throw new Error("Only drafts can be deleted.");
  await adapterFor(draft.mailbox).deleteDraft(draft.mailbox, draft.messageId);
  await db.emailMessage.delete({ where: { id } });
}

// Sent mail to a brand moves an UnTouched brand to Emailed.
async function applySent(brandId: string, date: Date) {
  const brand = await db.brand.findUnique({ where: { id: brandId } });
  if (!brand) return;
  await db.brand.update({
    where: { id: brandId },
    data: {
      status: brand.status === "UNTOUCHED" ? "EMAILED" : undefined,
      firstEmailedAt: brand.firstEmailedAt ?? date,
      lastEmailedAt: !brand.lastEmailedAt || brand.lastEmailedAt < date ? date : undefined,
    },
  });
}

// A reply from an Emailed brand moves it to Follow Up.
async function applyReply(brandId: string, date: Date) {
  const brand = await db.brand.findUnique({ where: { id: brandId } });
  if (!brand || !brand.firstEmailedAt || date < brand.firstEmailedAt) return;
  await db.brand.update({
    where: { id: brandId },
    data: {
      status: brand.status === "EMAILED" ? "FOLLOW_UP" : undefined,
      repliedAt: brand.repliedAt ?? date,
    },
  });
}

export async function sendDraft(id: string) {
  const draft = await db.emailMessage.findUniqueOrThrow({ where: { id }, include: { mailbox: true } });
  if (draft.folder !== "DRAFT") throw new Error("This message was already sent.");
  const adapter = adapterFor(draft.mailbox);
  await adapter.send(draft.mailbox, toOutgoing(draft.mailbox, draft));
  await adapter.deleteDraft(draft.mailbox, draft.messageId).catch(() => {});
  const now = new Date();
  const sent = await db.emailMessage.update({
    where: { id },
    data: { folder: "SENT", date: now, imapUid: null },
  });
  if (sent.brandId) await applySent(sent.brandId, now);
  return sent;
}

function domainOf(value?: string | null) {
  if (!value) return null;
  const v = value.toLowerCase().trim();
  const host = v.includes("@") ? v.split("@")[1] : v.replace(/^https?:\/\//, "").split("/")[0];
  return host.replace(/^www\./, "") || null;
}

type MatchBrand = Pick<Brand, "id" | "email" | "website">;

function matchBrand(brands: MatchBrand[], address: string) {
  const a = address.toLowerCase();
  const exact = brands.find((b) => b.email?.toLowerCase() === a);
  if (exact) return exact;
  const d = domainOf(a);
  if (!d) return undefined;
  return brands.find((b) => domainOf(b.email) === d || domainOf(b.website) === d);
}

// Mirrors a real mailbox into the app and applies status changes for any
// mail sent to, or received from, this client's brands.
export async function syncMailbox(mailboxId: string) {
  const mailbox = await db.mailbox.findUniqueOrThrow({ where: { id: mailboxId } });
  const since = new Date((mailbox.lastSyncedAt?.getTime() ?? Date.now() - 30 * DAY) - DAY);
  let result;
  try {
    result = await adapterFor(mailbox).fetch(mailbox, since);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.mailbox.update({ where: { id: mailboxId }, data: { lastError: message } });
    throw err;
  }
  if (!result) return { imported: 0 };

  const brands = await db.brand.findMany({
    where: { clientId: mailbox.clientId },
    select: { id: true, email: true, website: true },
  });
  let imported = 0;

  for (const m of result.messages) {
    const counterpart = m.folder === "INBOX" ? m.from : m.to;
    const brand = matchBrand(brands, counterpart);
    const existing = await db.emailMessage.findUnique({
      where: { mailboxId_folder_messageId: { mailboxId, folder: m.folder, messageId: m.messageId } },
    });
    if (existing) {
      if (m.folder === "DRAFT" && existing.imapUid !== m.uid) {
        await db.emailMessage.update({ where: { id: existing.id }, data: { imapUid: m.uid } });
      }
      continue;
    }

    // A draft created here and sent from the mail client keeps its kind.
    const asDraft =
      m.folder === "SENT"
        ? await db.emailMessage.findUnique({
            where: { mailboxId_folder_messageId: { mailboxId, folder: "DRAFT", messageId: m.messageId } },
          })
        : null;
    let kind = asDraft?.kind ?? (m.folder === "INBOX" ? (brand ? "REPLY" : "OTHER") : "OTHER");
    if (!asDraft && m.folder !== "INBOX" && brand) {
      const priorSent = await db.emailMessage.count({ where: { brandId: brand.id, folder: "SENT" } });
      kind = priorSent ? "FOLLOW_UP" : "OUTREACH";
    }

    await db.emailMessage.create({
      data: {
        mailboxId,
        brandId: asDraft?.brandId ?? brand?.id,
        folder: m.folder,
        kind,
        messageId: m.messageId,
        inReplyTo: m.inReplyTo,
        imapUid: m.folder === "DRAFT" ? m.uid : null,
        fromAddress: m.from,
        toAddress: m.to,
        subject: m.subject,
        body: m.body,
        date: m.date,
      },
    });
    imported++;

    const brandId = asDraft?.brandId ?? brand?.id;
    if (brandId && m.folder === "SENT") await applySent(brandId, m.date);
    if (brandId && m.folder === "INBOX") await applyReply(brandId, m.date);
  }

  // Drafts sent or deleted in the mail client disappear here too.
  await db.emailMessage.deleteMany({
    where: {
      mailboxId,
      folder: "DRAFT",
      imapUid: { not: null },
      messageId: { notIn: [...result.draftIds] },
    },
  });

  await db.mailbox.update({ where: { id: mailboxId }, data: { lastSyncedAt: new Date(), lastError: null } });
  return { imported };
}

export async function syncAllMailboxes() {
  const mailboxes = await db.mailbox.findMany({ where: { provider: { not: "DEMO" } } });
  const results: { address: string; imported?: number; error?: string }[] = [];
  for (const mb of mailboxes) {
    try {
      const r = await syncMailbox(mb.id);
      results.push({ address: mb.address, imported: r.imported });
    } catch (err) {
      results.push({ address: mb.address, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

// Demo mailboxes only: pretend the brand answered, to try the workflow.
export async function simulateReply(brandId: string) {
  const brand = await db.brand.findUniqueOrThrow({ where: { id: brandId } });
  const lastSent = await db.emailMessage.findFirst({
    where: { brandId, folder: "SENT" },
    orderBy: { date: "desc" },
    include: { mailbox: true },
  });
  if (!lastSent) throw new Error("Send an email to this brand first.");
  if (lastSent.mailbox.provider !== "DEMO") throw new Error("Simulated replies only work on demo mailboxes.");
  const now = new Date();
  await db.emailMessage.create({
    data: {
      mailboxId: lastSent.mailboxId,
      brandId,
      folder: "INBOX",
      kind: "REPLY",
      messageId: newMessageId(lastSent.mailbox),
      inReplyTo: lastSent.messageId,
      fromAddress: brand.email ?? "brand@example.com",
      toAddress: lastSent.mailbox.address,
      subject: lastSent.subject.startsWith("Re:") ? lastSent.subject : `Re: ${lastSent.subject}`,
      body: `Hi,\n\nThanks for reaching out. Happy to talk. Can you share more about your store's monthly sales volume?\n\nBest,\n${brand.contactName ?? brand.name}`,
      date: now,
    },
  });
  await applyReply(brandId, now);
}
