import Anthropic from "@anthropic-ai/sdk";
import type { Brand, Category, Client, Mailbox } from "@prisma/client";
import { MARKETPLACE_LABELS } from "./constants";

type BrandCtx = Brand & { category: Category | null; client: Client };

export type DraftContent = { subject: string; body: string };

function senderName(mailbox: Mailbox, client: Client) {
  return mailbox.displayName || `${client.businessName || client.storeName || client.name} Team`;
}

function storeName(client: Client) {
  return client.storeName || client.businessName || client.name;
}

function templateOutreach(brand: BrandCtx, mailbox: Mailbox): DraftContent {
  const c = brand.client;
  const market = MARKETPLACE_LABELS[c.marketplace];
  const greeting = brand.contactName ? `Hi ${brand.contactName},` : `Hi ${brand.name} team,`;
  const category = brand.category ? ` in the ${brand.category.name} category` : "";
  return {
    subject: `Partnership inquiry: carrying ${brand.name} on ${market}`,
    body: `${greeting}

I'm reaching out from ${storeName(c)}, an established seller on ${market}. We've been following ${brand.name} and think your products${category} would be a strong fit for our customers.

We'd love to explore becoming an authorized reseller of ${brand.name}. We handle listing optimization, advertising and fulfillment, and we protect brand pricing and presentation on the marketplace.

Could you share your wholesale terms, or point me to the right person to talk to about an account?

Best regards,
${senderName(mailbox, c)}
${storeName(c)}${c.website ? `\n${c.website}` : ""}
${mailbox.address}`,
  };
}

function templateFollowUp(brand: BrandCtx, mailbox: Mailbox, previousSubject: string): DraftContent {
  const c = brand.client;
  const greeting = brand.contactName ? `Hi ${brand.contactName},` : `Hi ${brand.name} team,`;
  return {
    subject: previousSubject.startsWith("Re:") ? previousSubject : `Re: ${previousSubject}`,
    body: `${greeting}

I wanted to follow up on my note from a few days ago about carrying ${brand.name} at ${storeName(c)} on ${MARKETPLACE_LABELS[c.marketplace]}.

If now isn't a good time, or there's someone else I should speak with about wholesale accounts, just let me know and I'll reach out to them instead.

Thanks, and looking forward to hearing from you.

Best regards,
${senderName(mailbox, c)}
${storeName(c)}
${mailbox.address}`,
  };
}

// When ANTHROPIC_API_KEY is set, Claude writes a personalised draft; otherwise
// (or on any error) the templates above are used.
async function aiDraft(prompt: string): Promise<DraftContent | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "You write short, professional B2B outreach emails for an e-commerce reseller contacting brands. " +
        "Reply with the subject on the first line as 'Subject: ...', a blank line, then the plain-text body. " +
        "No markdown, no placeholders in brackets.",
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const match = text.match(/^Subject:\s*(.+)\n+([\s\S]+)$/);
    if (!match) return null;
    return { subject: match[1].trim(), body: match[2].trim() };
  } catch (err) {
    console.error("AI draft failed, using template", err);
    return null;
  }
}

function brandFacts(brand: BrandCtx, mailbox: Mailbox) {
  const c = brand.client;
  return [
    `Brand: ${brand.name}`,
    brand.category && `Category: ${brand.category.name}`,
    brand.website && `Brand website: ${brand.website}`,
    brand.description && `About the brand: ${brand.description}`,
    brand.contactName && `Contact name: ${brand.contactName}`,
    `Our store: ${storeName(c)} on ${MARKETPLACE_LABELS[c.marketplace]}`,
    c.website && `Our website: ${c.website}`,
    `Sign as: ${senderName(mailbox, c)}, ${mailbox.address}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function outreachDraft(brand: BrandCtx, mailbox: Mailbox): Promise<DraftContent> {
  const ai = await aiDraft(
    `Write a first outreach email asking to become an authorized reseller of this brand.\n\n${brandFacts(brand, mailbox)}`,
  );
  return ai ?? templateOutreach(brand, mailbox);
}

export async function followUpDraft(
  brand: BrandCtx,
  mailbox: Mailbox,
  previous: { subject: string; body: string },
): Promise<DraftContent> {
  const ai = await aiDraft(
    `The brand has not replied for 3 days. Write a brief, polite follow-up to the email below. Keep the subject as "Re: <original subject>".\n\n${brandFacts(brand, mailbox)}\n\nOriginal email:\nSubject: ${previous.subject}\n\n${previous.body}`,
  );
  const fallback = templateFollowUp(brand, mailbox, previous.subject);
  return ai ? { ...ai, subject: fallback.subject } : fallback;
}
