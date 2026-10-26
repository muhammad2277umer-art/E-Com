import type { Client } from "@prisma/client";
import { saveClient } from "@/app/actions";
import { MARKETPLACES, MARKETPLACE_LABELS } from "@/lib/constants";
import { Field, btnPrimary, input } from "./ui";

export function ClientForm({ client }: { client?: Client | null }) {
  const t = (k: keyof Client) => (client?.[k] as string | null | undefined) ?? "";
  return (
    <form action={saveClient} className="space-y-4">
      {client && <input type="hidden" name="id" value={client.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Client name *"><input name="name" required defaultValue={t("name")} className={input} /></Field>
        <Field label="Store name"><input name="storeName" defaultValue={t("storeName")} className={input} /></Field>
        <Field label="Business name"><input name="businessName" defaultValue={t("businessName")} className={input} /></Field>
        <Field label="Marketplace">
          <select name="marketplace" defaultValue={client?.marketplace ?? "AMAZON"} className={input}>
            {MARKETPLACES.map((m) => <option key={m} value={m}>{MARKETPLACE_LABELS[m]}</option>)}
          </select>
        </Field>
        <Field label="Email"><input name="email" type="email" defaultValue={t("email")} className={input} /></Field>
        <Field label="Phone"><input name="phone" defaultValue={t("phone")} className={input} /></Field>
        <Field label="Domains (comma separated)">
          <input name="domains" defaultValue={client?.domains.join(", ") ?? ""} placeholder="abc.com, abcstore.com" className={input} />
        </Field>
        <Field label="Website"><input name="website" defaultValue={t("website")} className={input} /></Field>
        <Field label="Address"><input name="address" defaultValue={t("address")} className={input} /></Field>
        <Field label="Instagram"><input name="instagram" defaultValue={t("instagram")} className={input} /></Field>
        <Field label="Facebook"><input name="facebook" defaultValue={t("facebook")} className={input} /></Field>
        <Field label="TikTok"><input name="tiktok" defaultValue={t("tiktok")} className={input} /></Field>
        <Field label="LinkedIn"><input name="linkedin" defaultValue={t("linkedin")} className={input} /></Field>
      </div>
      <Field label="Notes"><textarea name="notes" rows={3} defaultValue={t("notes")} className={input} /></Field>
      <button className={btnPrimary}>{client ? "Save changes" : "Add client"}</button>
    </form>
  );
}
