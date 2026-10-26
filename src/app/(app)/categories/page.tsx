import Link from "next/link";
import { createCategory, deleteCategory, renameCategory } from "@/app/actions";
import { db } from "@/lib/db";
import { Card, Flash, PageHeader, btnDanger, btnPrimary, btnSecondary, input, one, type SearchParams } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const categories = await db.category.findMany({ include: { _count: { select: { brands: true } } }, orderBy: { name: "asc" } });
  return (
    <div className="max-w-2xl">
      <PageHeader title="Categories" subtitle="Create as many brand categories as you need." />
      <Flash msg={one(sp.msg)} error={one(sp.error)} />
      <Card className="mb-6">
        <form action={createCategory} className="flex gap-2">
          <input name="name" placeholder="New category name" className={input} required />
          <button className={btnPrimary}>Add</button>
        </form>
      </Card>
      <Card>
        {categories.length === 0 && <p className="text-sm text-slate-500">No categories yet.</p>}
        <ul className="divide-y divide-slate-100">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
              <form action={renameCategory} className="flex flex-1 gap-2">
                <input type="hidden" name="id" value={c.id} />
                <input name="name" defaultValue={c.name} className={input} />
                <button className={btnSecondary}>Rename</button>
              </form>
              <Link href={`/brands?categoryId=${c.id}`} className="w-20 text-right text-xs text-indigo-600 hover:underline">
                {c._count.brands} brand{c._count.brands === 1 ? "" : "s"}
              </Link>
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={c.id} />
                <button className={btnDanger}>Delete</button>
              </form>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
