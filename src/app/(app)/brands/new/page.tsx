import { db } from "@/lib/db";
import { BrandForm } from "@/components/brand-form";
import { Card, Flash, PageHeader, one, type SearchParams } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewBrandPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const [clients, categories] = await Promise.all([
    db.client.findMany({ include: { mailboxes: true }, orderBy: { name: "asc" } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader title="Add hunted brand" />
      <Flash error={one(sp.error)} />
      <Card><BrandForm clients={clients} categories={categories} defaultClientId={one(sp.clientId)} /></Card>
    </div>
  );
}
