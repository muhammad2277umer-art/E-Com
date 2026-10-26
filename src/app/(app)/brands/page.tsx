import Link from "next/link";
import type { BrandStatus, Prisma } from "@prisma/client";
import { writeDraft, writeFollowUp } from "@/app/actions";
import { db } from "@/lib/db";
import { STATUSES, STATUS_LABELS, VENDOR_LABELS } from "@/lib/constants";
import { isFollowUpDue } from "@/lib/workflow";
import { Flash, PageHeader, StatusBadge, btnPrimary, btnSecondary, fmtDate, input, one, type SearchParams } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BrandsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = one(sp.q);
  const status = one(sp.status) as BrandStatus | undefined;
  const clientId = one(sp.clientId);
  const categoryId = one(sp.categoryId);
  const onlyDrafts = one(sp.drafts) === "1";

  const where: Prisma.BrandWhereInput = {
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { website: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(status && STATUSES.includes(status) && { status }),
    ...(clientId && { clientId: clientId === "none" ? null : clientId }),
    ...(categoryId && { categoryId }),
    ...(onlyDrafts && { emails: { some: { folder: "DRAFT" } } }),
  };

  const [brands, clients, categories] = await Promise.all([
    db.brand.findMany({ where, include: { client: true, category: true }, orderBy: { createdAt: "desc" } }),
    db.client.findMany({ orderBy: { name: "asc" } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  const drafts = await db.emailMessage.groupBy({
    by: ["brandId", "kind"],
    where: { folder: "DRAFT", brandId: { in: brands.map((b) => b.id) } },
    _count: true,
  });
  const draftCount = (id: string, kind?: string) =>
    drafts.filter((d) => d.brandId === id && (!kind || d.kind === kind)).reduce((n, d) => n + d._count, 0);
  const query = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && !["msg", "error"].includes(k) ? [[k, v]] : [])));
  const returnTo = `/brands${query.size ? `?${query}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Brands"
        subtitle={`${brands.length} brand${brands.length === 1 ? "" : "s"}`}
        actions={<Link href="/brands/new" className={btnPrimary}>Add brand</Link>}
      />
      <Flash msg={one(sp.msg)} error={one(sp.error)} />

      <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <input name="q" defaultValue={q} placeholder="Search name, email, website" className={`${input} lg:col-span-2`} />
        <select name="status" defaultValue={status ?? ""} className={input}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select name="clientId" defaultValue={clientId ?? ""} className={input}>
          <option value="">All clients</option>
          <option value="none">Not linked to a client</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="categoryId" defaultValue={categoryId ?? ""} className={input}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-sm text-slate-600">
            <input type="checkbox" name="drafts" value="1" defaultChecked={onlyDrafts} /> Has drafts
          </label>
          <button className={btnSecondary}>Filter</button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Brand</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Vendor type</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Pending drafts</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {brands.map((b) => {
              const pending = draftCount(b.id);
              const due = isFollowUpDue(b, draftCount(b.id, "FOLLOW_UP"));
              return (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={`/brands/${b.id}`} className="font-medium text-indigo-700 hover:underline">{b.name}</Link>
                    {b.email && <div className="text-xs text-slate-500">{b.email}</div>}
                  </td>
                  <td className="px-3 py-2">{b.category?.name ?? <span className="text-slate-400">None</span>}</td>
                  <td className="px-3 py-2">{VENDOR_LABELS[b.vendorType]}</td>
                  <td className="px-3 py-2">
                    {b.client ? <Link href={`/clients/${b.client.id}`} className="hover:underline">{b.client.name}</Link> : <span className="text-slate-400">Not linked</span>}
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                  <td className="px-3 py-2">
                    {pending ? (
                      <Link href={`/brands/${b.id}#emails`} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{pending} pending</Link>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{fmtDate(b.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {due && (
                        <form action={writeFollowUp}>
                          <input type="hidden" name="brandId" value={b.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <button className={btnPrimary}>Write follow-up</button>
                        </form>
                      )}
                      <form action={writeDraft}>
                        <input type="hidden" name="brandId" value={b.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <button className={btnSecondary} disabled={!b.clientId || !b.email} title={!b.clientId ? "Link a client first" : !b.email ? "Add the brand email first" : ""}>
                          Write draft
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {brands.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No brands match. <Link href="/brands/new" className="text-indigo-600 hover:underline">Add one</Link>.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
