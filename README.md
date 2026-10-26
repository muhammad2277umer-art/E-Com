# Brand Hunting CRM

Track hunted brands for your e-commerce clients, write outreach and follow-up emails from each client's worker mailbox, and see every client's inbox, sent and drafts in one place.

Built with Next.js 15 (React + server in one app), TypeScript, Prisma and Postgres (Neon). Deploys to Vercel.

## What it does

- **Brands**: name, category (create as many as you like), vendor type, status, client, contact person, email, phone, website, socials, address, description, created date.
- **Status workflow**: every brand starts as **UnTouched**. Sending the outreach email sets it to **Emailed**. A reply from the brand sets it to **Follow Up**. You mark it **Approved** or **Rejected** when the deal is decided.
- **Write draft**: one click writes an outreach email for the brand and saves it to the client's mailbox Drafts. Edit it, then send.
- **Write follow-up draft**: available for Emailed brands with no reply 3 days after the last email. The dashboard lists every brand that's due, with a "write all" button.
- **Pending drafts**: shown per brand (brands list, brand page), per client, and in total on the dashboard.
- **Clients**: name, store name, business name, email, domains, website, socials, phone, address, and marketplace (Amazon, Walmart, Shopify, TikTok Shop, eBay, Etsy, Other). Each client page lists the brands hunted for them.
- **Per-client mailbox**: connect each worker mailbox (for example worker1@abc.com) to its client. The client page shows Inbox, Sent and Drafts, filterable by brand. Mail is matched to brands by the brand's email address or website domain.

## Run it on your computer

You need Node.js 20 or newer.

1. Install packages:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill it in. In the Neon console, **Connect** shows your connection string: use the pooled one (host contains `-pooler`, add `&pgbouncer=true` at the end) for `DATABASE_URL`, and the same string without `-pooler` for `DIRECT_URL`. Set `APP_SECRET`, `APP_PASSWORD` and `CRON_SECRET` to your own values.
3. Create the tables in the database:
   ```bash
   npm run db:push
   ```
4. Optional: load sample clients and brands to click around with:
   ```bash
   npm run db:seed
   ```
5. Start the app:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 and sign in with your `APP_PASSWORD`.

## Connecting mailboxes

On a client's page, open **Add a mailbox**.

- **Real mailbox (IMAP/SMTP)** works with Gmail / Google Workspace, Outlook / Microsoft 365, Zoho, Titan and most other providers. Server settings for the common ones are shown on the form. Gmail and Google Workspace need an **app password** (Google Account, Security, 2-Step Verification, App passwords) rather than the normal password. Microsoft 365 tenants must have SMTP AUTH and IMAP enabled for the mailbox.
- **Demo** mailboxes keep everything inside the app and never send real email. A "Simulate brand reply" button on the brand page lets you try the whole workflow.

Drafts written in the app are saved to the real mailbox's Drafts folder, so your team can also send them from Gmail or Outlook. Use **Sync now** on the client page to pull in new mail. Mail sent from the mail client and replies from brands update brand statuses on sync. Passwords are stored encrypted with `APP_SECRET`.

### Drafting with AI (optional)

Set `ANTHROPIC_API_KEY` and the Write draft buttons use Claude to write a personalised email from the brand's details. Without a key, built-in templates are used. Claude requests use the server-side refusal fallback, so a declined request is retried on another model automatically.

## Deploy to Vercel

1. Push this project to a GitHub repository.
2. In Vercel, **Add New Project**, import the repository.
3. Add the same environment variables as your `.env` (`DATABASE_URL`, `DIRECT_URL`, `APP_SECRET`, `APP_PASSWORD`, `CRON_SECRET`, optional `ANTHROPIC_API_KEY`).
4. Deploy. `vercel.json` schedules a mailbox sync every 6 hours (Vercel's Hobby plan only allows one run per day; change the schedule to `0 6 * * *` there, or use Pro).

## Project layout

- `prisma/schema.prisma`: database tables
- `src/lib/workflow.ts`: drafts, sending, follow-up rules, mailbox sync and status changes
- `src/lib/mail/`: mailbox providers (`imap.ts`, `demo.ts`). Add a Gmail API or Microsoft Graph provider here by implementing `MailAdapter`.
- `src/lib/drafts.ts`: outreach and follow-up email text
- `src/app/(app)/`: pages (dashboard, brands, clients, categories)
- `src/app/actions.ts`: form actions
