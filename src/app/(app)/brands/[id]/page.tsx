import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteBrand, setBrandStatus, simulateReply, writeDraft, writeFollowUp } from "@/app/actions";
import { db } from "@/lib/db";
import { FOLLOW_UP_AFTER_DAYS, MARKETPLACE_LABELS, VENDOR_LABELS } from "@/lib/constants";
import { isFollowUpDue } from "@/lib/workflow";
import { BrandForm } from "@/components/brand-form";
import { MessageList } from "@/components/messages";
import {
  Card, ExtLink, Flash, Info, PageHeader, StatusBadge, btnDanger, btnPrimary, btnSecondary, btnSuccess,
  fmtDate, fmtDateTime, one, type SearchParams,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BrandPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const brand = await db.brand.findUnique({
    where: { id },
    include: {
      category: true,
      client: { include: { mailboxes: true } },
      mailbox: true,
      emails: { include: { mailbox: { select: { address: true } } }, orderBy: { date: "desc" } },
    },
  });
  if (!brand) notFound();
  const [clients, categories] = await Promise.all([
    db.client.findMany({ include: { mailboxes: true }, orderBy: { name: "asc" } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const drafts = brand.emails.filter((e) => e.folder === "DRAFT");
  const sent = brand.emails.filter((e) => e.folder === "SENT");
  const inbox = brand.emails.filter((e) => e.folder === "INBOX");
  const pendingFollowUps = drafts.filter((d) => d.kind === "FOLLOW_UP").length;
  const followUpDue = isFollowUpDue(brand, pendingFollowUps);
  const mailbox = brand.mailbox ?? brand.client?.mailboxes[0];
  const draftBlocker = !brand.client
    ? "Link this brand to a client first."
    : !brand.email
      ? "Add the brand's email address first."
      : !mailbox
        ? `Add a mailbox to ${brand.client.name} first.`
        : null;
  const followUpAt = brand.lastEmailedAt ? new Date(brand.lastEmailedAt.getTime() + FOLLOW_UP_AFTER_DAYS * 86400000) : null;
  const followUpHint = followUpDue
    ? null
    : brand.status !== "EMAILED"
      ? "Available once the brand is Emailed and hasn't replied."
      : pendingFollowUps
        ? "A follow-up draft is already waiting."
        : followUpAt
          ? `Available from ${fmtDateTime(followUpAt)} if there's no reply.`
          : null;
  const returnTo = `/brands/${brand.id}`;

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3">{brand.name} <StatusBadge status={brand.status} /></span>}
        subtitle={
          <>
            {brand.category?.name ?? "No category"} · {VENDOR_LABELS[brand.vendorType]} · hunted for{" "}
            {brand.client ? (
              <Link href={`/clients/${brand.client.id}`} className="text-indigo-600 hover:underline">
                {brand.client.name} ({MARKETPLACE_LABELS[brand.client.marketplace]})
              </Link>
            ) : (
              "no client yet"
            )}
          </>
        }
      />
      <Flash msg={one(sp.msg)} error={one(sp.error)} />

      <Card title="Actions" className="mb-6">
        <div className="flex flex-wrap items-start gap-2">
          <form action={writeDraft}>
            <input type="hidden" name="brandId" value={brand.id} />
            <button className={btnPrimary} disabled={!!draftBlocker}>Write draft</button>
          </form>
          <form action={writeFollowUp}>
            <input type="hidden" name="brandId" value={brand.id} />
            <button className={btnPrimary} disabled={!followUpDue}>Write follow-up draft</button>
          </form>
          {(["APPROVED", "REJECTED"] as const).map((s) => (
            <form key={s} action={setBrandStatus}>
              <input type="hidden" name="id" value={brand.id} />
              <input type="hidden" name="status" value={s} />
              <button className={s === "APPROVED" ? btnSuccess : btnDanger} disabled={brand.status === s}>
                Mark {s === "APPROVED" ? "Approved" : "Rejected"}
              </button>
            </form>
          ))}
          {mailbox?.provider === "DEMO" && sent.length > 0 && (
            <form action={simulateReply}>
              <input type="hidden" name="brandId" value={brand.id} />
              <button className={btnSecondary} title="Demo mailboxes only">Simulate brand reply</button>
            </form>
          )}
        </div>
        <div className="mt-3 space-y-1 text-xs text-slate-500">
          {draftBlocker && <p>Write draft: {draftBlocker}</p>}
          {followUpHint && <p>Follow-up: {followUpHint}</p>}
          {mailbox && <p>Drafts are saved to {mailbox.address}.</p>}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-1">
          <dl className="space-y-3">
            <Info label="Contact person" value={brand.contactName} />
            <Info label="Email" value={brand.email} />
            <Info label="Phone" value={brand.phone} />
            <Info label="Website" value={<ExtLink href={brand.website} />} />
            <Info label="Instagram" value={brand.instagram} />
            <Info label="Facebook" value={brand.facebook} />
            <Info label="TikTok" value={brand.tiktok} />
            <Info label="LinkedIn" value={brand.linkedin} />
            <Info label="Address" value={brand.address} />
            <Info label="Description" value={brand.description} />
            <Info label="Created" value={fmtDate(brand.createdAt)} />
            <Info label="First emailed" value={fmtDateTime(brand.firstEmailedAt)} />
            <Info label="Last emailed" value={fmtDateTime(brand.lastEmailedAt)} />
            <Info label="Replied" value={fmtDateTime(brand.repliedAt)} />
          </dl>
        </Card>

        <div id="emails" className="space-y-6 lg:col-span-2">
          <Card title={`Drafts pending (${drafts.length})`}>
            <MessageList messages={drafts} returnTo={returnTo} showMailbox empty="No pending drafts for this brand." />
          </Card>
          <Card title={`Sent (${sent.length})`}>
            <MessageList messages={sent} returnTo={returnTo} showMailbox empty="Nothing sent yet." />
          </Card>
          <Card title={`Replies (${inbox.length})`}>
            <MessageList messages={inbox} returnTo={returnTo} showMailbox empty="No replies yet." />
          </Card>
        </div>
      </div>

      <details className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">Edit brand</summary>
        <div className="border-t border-slate-100 p-4">
          <BrandForm brand={brand} clients={clients} categories={categories} />
          <form action={deleteBrand} className="mt-6 border-t border-slate-100 pt-4">
            <input type="hidden" name="id" value={brand.id} />
            <button className={btnDanger}>Delete brand</button>
          </form>
        </div>
      </details>
    </div>
  );
}
