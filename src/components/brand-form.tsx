import type { Brand, Category, Client, Mailbox } from "@prisma/client";
import { saveBrand } from "@/app/actions";
import { STATUSES, STATUS_LABELS, VENDOR_LABELS, VENDOR_TYPES } from "@/lib/constants";
import { Field, btnPrimary, input } from "./ui";

export function BrandForm({ brand, clients, categories, defaultClientId }: {
  brand?: Brand | null;
  clients: (Client & { mailboxes: Mailbox[] })[];
  categories: Category[];
  defaultClientId?: string;
}) {
  const t = (k: keyof Brand) => (brand?.[k] as string | null | undefined) ?? "";
  return (
    <form action={saveBrand} className="space-y-4">
      {brand && <input type="hidden" name="id" value={brand.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Brand name *"><input name="name" required defaultValue={t("name")} className={input} /></Field>
        <Field label="Category">
          <select name="categoryId" defaultValue={t("categoryId")} className={input}>
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Or create a new category"><input name="newCategory" placeholder="e.g. Pet supplies" className={input} /></Field>
        <Field label="Vendor type">
          <select name="vendorType" defaultValue={brand?.vendorType ?? "BRAND_OWNER"} className={input}>
            {VENDOR_TYPES.map((v) => <option key={v} value={v}>{VENDOR_LABELS[v]}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={brand?.status ?? "UNTOUCHED"} className={input}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </Field>
        <Field label="Client (hunted for)">
          <select name="clientId" defaultValue={brand?.clientId ?? defaultClientId ?? ""} className={input}>
            <option value="">Not linked yet</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.storeName ? ` (${c.storeName})` : ""}</option>)}
          </select>
        </Field>
        <Field label="Send from mailbox" className="sm:col-span-2 lg:col-span-1">
          <select name="mailboxId" defaultValue={t("mailboxId")} className={input}>
            <option value="">Client&apos;s first mailbox</option>
            {clients.filter((c) => c.mailboxes.length).map((c) => (
              <optgroup key={c.id} label={c.name}>
                {c.mailboxes.map((m) => <option key={m.id} value={m.id}>{m.address}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
      </div>

      <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Contact person"><input name="contactName" defaultValue={t("contactName")} className={input} /></Field>
        <Field label="Email"><input name="email" type="email" defaultValue={t("email")} className={input} /></Field>
        <Field label="Phone"><input name="phone" defaultValue={t("phone")} className={input} /></Field>
        <Field label="Website"><input name="website" defaultValue={t("website")} placeholder="brand.com" className={input} /></Field>
        <Field label="Instagram"><input name="instagram" defaultValue={t("instagram")} className={input} /></Field>
        <Field label="Facebook"><input name="facebook" defaultValue={t("facebook")} className={input} /></Field>
        <Field label="TikTok"><input name="tiktok" defaultValue={t("tiktok")} className={input} /></Field>
        <Field label="LinkedIn"><input name="linkedin" defaultValue={t("linkedin")} className={input} /></Field>
        <Field label="Physical address"><input name="address" defaultValue={t("address")} className={input} /></Field>
      </div>
      <Field label="Description">
        <textarea name="description" rows={4} defaultValue={t("description")} className={input} />
      </Field>
      <button className={btnPrimary}>{brand ? "Save changes" : "Add brand"}</button>
    </form>
  );
}
