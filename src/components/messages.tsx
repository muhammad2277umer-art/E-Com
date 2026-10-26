import Link from "next/link";
import type { Brand, EmailMessage, Mailbox } from "@prisma/client";
import { deleteDraft, saveDraft, sendDraft } from "@/app/actions";
import { btnDanger, btnPrimary, btnSecondary, fmtDateTime, input } from "./ui";

type Msg = EmailMessage & { brand?: Pick<Brand, "id" | "name"> | null; mailbox?: Pick<Mailbox, "address"> | null };

const KIND_LABEL: Record<EmailMessage["kind"], string> = {
  OUTREACH: "Outreach",
  FOLLOW_UP: "Follow-up",
  REPLY: "Reply",
  OTHER: "",
};

function Meta({ m, showMailbox }: { m: Msg; showMailbox?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      {KIND_LABEL[m.kind] && (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{KIND_LABEL[m.kind]}</span>
      )}
      {m.brand && (
        <Link href={`/brands/${m.brand.id}`} className="rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-700 hover:underline">
          {m.brand.name}
        </Link>
      )}
      {showMailbox && m.mailbox && <span>{m.mailbox.address}</span>}
      <span>{m.folder === "INBOX" ? `from ${m.fromAddress}` : `to ${m.toAddress}`}</span>
      <span>· {fmtDateTime(m.folder === "DRAFT" ? m.updatedAt : m.date)}</span>
    </div>
  );
}

function DraftEditor({ m, returnTo, showMailbox }: { m: Msg; returnTo: string; showMailbox?: boolean }) {
  return (
    <details className="group rounded-md border border-amber-200 bg-amber-50/40">
      <summary className="cursor-pointer list-none px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-slate-800">{m.subject}</span>
          <span className="shrink-0 text-xs text-amber-700 group-open:hidden">Open draft</span>
        </div>
        <Meta m={m} showMailbox={showMailbox} />
      </summary>
      <form className="space-y-2 border-t border-amber-200 p-3">
        <input type="hidden" name="id" value={m.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input name="toAddress" defaultValue={m.toAddress} className={input} aria-label="To" />
        <input name="subject" defaultValue={m.subject} className={input} aria-label="Subject" />
        <textarea name="body" defaultValue={m.body} rows={12} className={`${input} font-mono text-xs`} aria-label="Body" />
        <div className="flex flex-wrap gap-2">
          <button formAction={sendDraft} className={btnPrimary}>Send</button>
          <button formAction={saveDraft} className={btnSecondary}>Save draft</button>
          <button formAction={deleteDraft} className={btnDanger}>Delete</button>
        </div>
      </form>
    </details>
  );
}

function MessageView({ m, showMailbox }: { m: Msg; showMailbox?: boolean }) {
  return (
    <details className="rounded-md border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-3 py-2">
        <div className="truncate text-sm font-medium text-slate-800">{m.subject}</div>
        <Meta m={m} showMailbox={showMailbox} />
      </summary>
      <pre className="whitespace-pre-wrap border-t border-slate-100 p-3 font-sans text-sm text-slate-700">{m.body}</pre>
    </details>
  );
}

export function MessageList({ messages, returnTo, showMailbox, empty = "Nothing here yet." }: {
  messages: Msg[];
  returnTo: string;
  showMailbox?: boolean;
  empty?: string;
}) {
  if (!messages.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="space-y-2">
      {messages.map((m) =>
        m.folder === "DRAFT" ? (
          <DraftEditor key={m.id} m={m} returnTo={returnTo} showMailbox={showMailbox} />
        ) : (
          <MessageView key={m.id} m={m} showMailbox={showMailbox} />
        ),
      )}
    </div>
  );
}
