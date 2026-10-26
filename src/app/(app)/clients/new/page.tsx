import { ClientForm } from "@/components/client-form";
import { Card, Flash, PageHeader, one, type SearchParams } from "@/components/ui";

export default async function NewClientPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return (
    <div>
      <PageHeader title="Add client" />
      <Flash error={one(sp.error)} />
      <Card><ClientForm /></Card>
    </div>
  );
}
