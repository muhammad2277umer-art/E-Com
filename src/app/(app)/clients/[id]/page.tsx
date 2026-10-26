import Link from "next/link";
import { notFound } from "next/navigation";
import type { MailFolder } from "@prisma/client";
import { addMailbox, deleteClient, deleteMailbox, syncMailbox, writeDraft, writeFollowUp } from "@/app/actions";
import { db } from "@/lib/db";
import { MARKETPLACE_LABELS, VENDOR_LABELS } from "@/lib/constants";
import { isFollowUpDue } from "@/lib/workflow";
import { ClientForm } from "@/components/client-form";
import { MessageList } from "@/components/messages";
import {
  Card, ExtLink, Field, Flash, Info, PageHeader, StatusBadge, btnDanger, btnPrimary, btnSecondary,
  fmtDate, fmtDateTime, input, one, type SearchParams,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const FOLDERS: { key: MailFolder; label: string }[] = [
  { key: "INBOX", label: "Inbox" },
  { key: "SENT", label: "Sent" },
  { key: "DRAFT", label: "Drafts" },
];

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const client = await db.client.findUnique({
    where: { id },
    include: {
      brands: { include: { category: true }, orderBy: { name: "asc" } },
      mailboxes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!client) notFound();

  const mailbox = client.mailboxes.find((m) => m.id === one(sp.mb)) ?? client.mailboxes[0];
  const folder = (FOLDERS.find((f) => f.key === one(sp.folder))?.key ?? "INBOX") as MailFolder;
  const brandFilter = one(sp.brand);
  const brandWhere = brandFilter === "none" ? { brandId: null } : brandFilter ? { brandId: brandFilter } : {};

  const [folderCounts, messages, draftsByBrand] = await Promise.all([
    mailbox
      ? db.emailMessage.groupBy({ by: ["folder"], where: { mailboxId: mailbox.id, ...brandWhere }, _count: true })
      : [],
    mailbox
      ? db.emailMessage.findMany({
          where: { mailboxId: mailbox.id, folder, ...brandWhere },
          include: { brand: { select: { id: true, name: true } } },
          orderBy: folder === "DRAFT" ? { updatedAt: "desc" } : { date: "desc" },
          take: 100,
        })
      : [],
    db.emailMessage.groupBy({
      by: ["brandId", "kind"],
      where: { folder: "DRAFT", brandId: { in: client.brands.map((b) => b.id) } },
      _count: true,
    }),
  ]);
  const count = (f: MailFolder) => folderCounts.find((c) => c.folder === f)?._count ?? 0;
  const drafts = (brandId: string, kind?: string) =>
    draftsByBrand.filter((d) => d.brandId === brandId && (!kind || d.kind === kind)).reduce((n, d) => n + d._count, 0);

  const mbQuery = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { mb: mailbox?.id, folder, brand: brandFilter, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/clients/${client.id}?${q}#mailbox`;
  };
  const returnTo = mbQuery({}).replace("#mailbox", "");

  return (
    <div>
      <PageHeader
        title={client.name}
        subtitle={`${client.storeName ?? "No store name"} · ${MARKETPLACE_LABELS[client.marketplace]}`}
        actions={<Link href={`/brands/new?clientId=${client.id}`} className={btnPrimary}>Add brand for this client</Link>}
      />
      <Flash msg={one(sp.msg)} error={one(sp.error)} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Client info">
          <dl className="grid grid-cols-2 gap-3">
            <Info label="Business name" value={client.businessName} />
            <Info label="Store name" value={client.storeName} />
            <Info label="Marketplace" value={MARKETPLACE_LABELS[client.marketplace]} />
            <Info label="Email" value={client.email} />
            <Info label="Phone" value={client.phone} />
            <Info label="Domains" value={client.domains.join(", ")} />
            <Info label="Website" value={<ExtLink href={client.website} />} />
            <Info label="Instagram" value={client.instagram} />
            <Info label="Facebook" value={client.facebook} />
            <Info label="TikTok" value={client.tiktok} />
            <Info label="LinkedIn" value={client.linkedin} />
            <Info label="Address" value={client.address} />
            <Info label="Client since" value={fmtDate(client.createdAt)} />
          </dl>
          {client.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{client.notes}</p>}
        </Card>

        <Card title={`Brands hunted (${client.brands.length})`} className="lg:col-span-2">
          {client.brands.length === 0 ? (
            <p className="text-sm text-slate-500">No brands linked yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr><th className="pb-2">Brand</th><th className="pb-2">Category</th><th className="pb-2">Vendor</th><th className="pb-2">Status</th><th className="pb-2">Drafts</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {client.brands.map((b) => (
                    <tr key={b.id}>
                      <td className="py-2"><Link href={`/brands/${b.id}`} className="font-medium text-indigo-700 hover:underline">{b.name}</Link></td>
                      <td className="py-2">{b.category?.name}</td>
                      <td className="py-2">{VENDOR_LABELS[b.vendorType]}</td>
                      <td className="py-2"><StatusBadge status={b.status} /></td>
                      <td className="py-2">
                        {drafts(b.id) ? (
                          <Link href={mbQuery({ folder: "DRAFT", brand: b.id })} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{drafts(b.id)} pending</Link>
                        ) : <span className="text-slate-400">0</span>}
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          {isFollowUpDue(b, drafts(b.id, "FOLLOW_UP")) && (
                            <form action={writeFollowUp}>
                              <input type="hidden" name="brandId" value={b.id} />
                              <input type="hidden" name="returnTo" value={returnTo} />
                              <button className={btnPrimary}>Write follow-up</button>
                            </form>
                          )}
                          <form action={writeDraft}>
                            <input type="hidden" name="brandId" value={b.id} />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <button className={btnSecondary} disabled={!b.email || !client.mailboxes.length}>Write draft</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <section id="mailbox" className="mt-6">
        <Card
          title="Mailbox"
          actions={
            mailbox && (
              <>
                {mailbox.provider !== "DEMO" && (
                  <form action={syncMailbox}>
                    <input type="hidden" name="id" value={mailbox.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button className={btnSecondary}>Sync now</button>
                  </form>
                )}
                <form action={deleteMailbox}>
                  <input type="hidden" name="id" value={mailbox.id} />
                  <button className={btnDanger}>Remove mailbox</button>
                </form>
              </>
            )
          }
        >
          {client.mailboxes.length > 0 && mailbox ? (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {client.mailboxes.map((m) => (
                  <Link
                    key={m.id}
                    href={mbQuery({ mb: m.id, brand: undefined })}
                    className={`rounded-md border px-3 py-1.5 text-sm ${m.id === mailbox.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    {m.address}
                    <span className="ml-1 text-xs text-slate-400">{m.provider === "DEMO" ? "demo" : "IMAP"}</span>
                  </Link>
                ))}
              </div>
              <div className="mb-3 text-xs text-slate-500">
                {mailbox.provider === "DEMO"
                  ? "Demo mailbox: messages live in this app only. Sending marks the email as sent without delivering it."
                  : `Last synced ${mailbox.lastSyncedAt ? fmtDateTime(mailbox.lastSyncedAt) : "never"}.`}
                {mailbox.lastError && <span className="ml-2 text-rose-600">Last error: {mailbox.lastError}</span>}
              </div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex gap-1">
                  {FOLDERS.map((f) => (
                    <Link
                      key={f.key}
                      href={mbQuery({ folder: f.key })}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${f.key === folder ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                    >
                      {f.label} <span className="opacity-70">{count(f.key)}</span>
                    </Link>
                  ))}
                </div>
                <form className="flex gap-2" action={`/clients/${client.id}#mailbox`}>
                  <input type="hidden" name="mb" value={mailbox.id} />
                  <input type="hidden" name="folder" value={folder} />
                  <select name="brand" defaultValue={brandFilter ?? ""} className={input}>
                    <option value="">All brands</option>
                    <option value="none">Not linked to a brand</option>
                    {client.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <button className={btnSecondary}>Filter</button>
                </form>
              </div>
              <MessageList messages={messages} returnTo={returnTo} empty={`No ${FOLDERS.find((f) => f.key === folder)!.label.toLowerCase()} messages.`} />
            </>
          ) : (
            <p className="text-sm text-slate-500">No mailbox yet. Add the worker mailbox used for this client below.</p>
          )}

          <details className="mt-6 rounded-md border border-slate-200">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">Add a mailbox</summary>
            <form action={addMailbox} className="space-y-3 border-t border-slate-100 p-3">
              <input type="hidden" name="clientId" value={client.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Email address *"><input name="address" type="email" required placeholder={`worker1@${client.domains[0] ?? "client.com"}`} className={input} /></Field>
                <Field label="Sender name"><input name="displayName" placeholder="e.g. Sarah from ABC" className={input} /></Field>
                <Field label="Type">
                  <select name="provider" className={input} defaultValue="IMAP">
                    <option value="IMAP">Real mailbox (IMAP/SMTP)</option>
                    <option value="DEMO">Demo (no real email)</option>
                  </select>
                </Field>
              </div>
              <p className="text-xs text-slate-500">For a real mailbox, fill in the server details below. Gmail and Google Workspace need an app password (Google Account, Security, App passwords).</p>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="IMAP host"><input name="imapHost" placeholder="imap.gmail.com" className={input} /></Field>
                <Field label="IMAP port"><input name="imapPort" placeholder="993" className={input} /></Field>
                <Field label="SMTP host"><input name="smtpHost" placeholder="smtp.gmail.com" className={input} /></Field>
                <Field label="SMTP port"><input name="smtpPort" placeholder="465" className={input} /></Field>
                <Field label="Username (if not the address)"><input name="username" className={input} /></Field>
                <Field label="Password / app password"><input name="password" type="password" className={input} autoComplete="new-password" /></Field>
                <Field label="Sent folder (optional)"><input name="sentFolder" placeholder="auto-detect" className={input} /></Field>
                <Field label="Drafts folder (optional)"><input name="draftsFolder" placeholder="auto-detect" className={input} /></Field>
              </div>
              <table className="text-xs text-slate-500">
                <tbody>
                  <tr><td className="pr-4 font-medium">Gmail / Workspace</td><td>imap.gmail.com : 993 · smtp.gmail.com : 465</td></tr>
                  <tr><td className="pr-4 font-medium">Outlook / Microsoft 365</td><td>outlook.office365.com : 993 · smtp.office365.com : 587</td></tr>
                  <tr><td className="pr-4 font-medium">Zoho</td><td>imap.zoho.com : 993 · smtp.zoho.com : 465</td></tr>
                  <tr><td className="pr-4 font-medium">Titan / GoDaddy</td><td>imap.titan.email : 993 · smtp.titan.email : 465</td></tr>
                </tbody>
              </table>
              <button className={btnPrimary}>Add mailbox</button>
            </form>
          </details>
        </Card>
      </section>

      <details className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">Edit client</summary>
        <div className="border-t border-slate-100 p-4">
          <ClientForm client={client} />
          <form action={deleteClient} className="mt-6 border-t border-slate-100 pt-4">
            <input type="hidden" name="id" value={client.id} />
            <button className={btnDanger}>Delete client</button>
            <span className="ml-2 text-xs text-slate-500">Brands stay, unlinked. Mailboxes and their messages are removed.</span>
          </form>
        </div>
      </details>
    </div>
  );
}
