import Link from "next/link";
import { db } from "@/lib/db";
import { MARKETPLACE_LABELS, STATUS_STYLES } from "@/lib/constants";
import { Flash, PageHeader, btnPrimary, one, type SearchParams } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const clients = await db.client.findMany({
    include: {
      brands: { select: { id: true, name: true, status: true }, orderBy: { name: "asc" } },
      mailboxes: { select: { id: true, address: true, _count: { select: { messages: { where: { folder: "DRAFT" } } } } } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} client${clients.length === 1 ? "" : "s"}`}
        actions={<Link href="/clients/new" className={btnPrimary}>Add client</Link>}
      />
      <Flash msg={one(sp.msg)} error={one(sp.error)} />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Marketplace</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Brands hunted</th>
              <th className="px-3 py-2">Mailboxes</th>
              <th className="px-3 py-2">Pending drafts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {clients.map((c) => {
              const drafts = c.mailboxes.reduce((n, m) => n + m._count.messages, 0);
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={`/clients/${c.id}`} className="font-medium text-indigo-700 hover:underline">{c.name}</Link>
                    {c.storeName && <div className="text-xs text-slate-500">{c.storeName}</div>}
                  </td>
                  <td className="px-3 py-2">{MARKETPLACE_LABELS[c.marketplace]}</td>
                  <td className="px-3 py-2">
                    <div>{c.email}</div>
                    {c.domains.length > 0 && <div className="text-xs text-slate-500">{c.domains.join(", ")}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="mb-1 text-xs text-slate-500">{c.brands.length} brand{c.brands.length === 1 ? "" : "s"}</div>
                    <div className="flex max-w-md flex-wrap gap-1">
                      {c.brands.map((b) => (
                        <Link key={b.id} href={`/brands/${b.id}`} className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[b.status]}`}>
                          {b.name}
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">{c.mailboxes.map((m) => <div key={m.id}>{m.address}</div>)}</td>
                  <td className="px-3 py-2">
                    {drafts ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{drafts}</span> : <span className="text-slate-400">0</span>}
                  </td>
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No clients yet. <Link href="/clients/new" className="text-indigo-600 hover:underline">Add one</Link>.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
