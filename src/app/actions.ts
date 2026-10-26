"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BrandStatus, Marketplace, MailProvider, VendorType } from "@prisma/client";
import { AUTH_COOKIE, authToken } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { adapterFor } from "@/lib/mail";
import * as wf from "@/lib/workflow";

function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function withParam(path: string, key: string, value: string) {
  const [base, query] = path.split("?");
  const params = new URLSearchParams(query);
  params.delete("msg");
  params.delete("error");
  params.set(key, value);
  return `${base}?${params}`;
}

// Runs an action, then returns to the page with a success or error banner.
async function run(returnTo: string, fn: () => Promise<string | void>, success?: string): Promise<never> {
  let target: string;
  try {
    const msg = (await fn()) || success;
    target = msg ? withParam(returnTo, "msg", msg) : returnTo;
  } catch (err) {
    target = withParam(returnTo, "error", err instanceof Error ? err.message : String(err));
  }
  revalidatePath("/", "layout");
  redirect(target);
}

function back(form: FormData, fallback: string) {
  const r = str(form, "returnTo");
  return r && r.startsWith("/") ? r : fallback;
}

// ---- auth ----

export async function login(form: FormData) {
  const next = str(form, "next") ?? "/";
  if (str(form, "password") !== process.env.APP_PASSWORD) {
    redirect(`/login?error=${encodeURIComponent("Wrong password")}&next=${encodeURIComponent(next)}`);
  }
  (await cookies()).set(AUTH_COOKIE, await authToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect(next.startsWith("/") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}

// ---- categories ----

export async function createCategory(form: FormData) {
  const name = str(form, "name");
  return run(back(form, "/categories"), async () => {
    if (!name) throw new Error("Category name is required.");
    await db.category.create({ data: { name } });
  }, "Category added");
}

export async function renameCategory(form: FormData) {
  const id = str(form, "id")!;
  const name = str(form, "name");
  return run("/categories", async () => {
    if (!name) throw new Error("Category name is required.");
    await db.category.update({ where: { id }, data: { name } });
  }, "Category renamed");
}

export async function deleteCategory(form: FormData) {
  const id = str(form, "id")!;
  return run("/categories", async () => {
    await db.category.delete({ where: { id } });
  }, "Category deleted");
}

// ---- clients ----

export async function saveClient(form: FormData) {
  const id = str(form, "id");
  const data = {
    name: str(form, "name") ?? "",
    storeName: str(form, "storeName"),
    businessName: str(form, "businessName"),
    email: str(form, "email"),
    phone: str(form, "phone"),
    domains: (str(form, "domains") ?? "").split(/[\s,]+/).filter(Boolean),
    website: str(form, "website"),
    instagram: str(form, "instagram"),
    facebook: str(form, "facebook"),
    tiktok: str(form, "tiktok"),
    linkedin: str(form, "linkedin"),
    address: str(form, "address"),
    marketplace: (str(form, "marketplace") ?? "AMAZON") as Marketplace,
    notes: str(form, "notes"),
  };
  let savedId = id;
  const returnTo = id ? `/clients/${id}` : "/clients/new";
  try {
    if (!data.name) throw new Error("Client name is required.");
    const saved = id
      ? await db.client.update({ where: { id }, data })
      : await db.client.create({ data });
    savedId = saved.id;
  } catch (err) {
    redirect(withParam(returnTo, "error", err instanceof Error ? err.message : String(err)));
  }
  revalidatePath("/", "layout");
  redirect(withParam(`/clients/${savedId}`, "msg", "Client saved"));
}

export async function deleteClient(form: FormData) {
  const id = str(form, "id")!;
  await db.client.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect(withParam("/clients", "msg", "Client deleted"));
}

// ---- brands ----

export async function saveBrand(form: FormData) {
  const id = str(form, "id");
  const data = {
    name: str(form, "name") ?? "",
    categoryId: str(form, "categoryId"),
    vendorType: (str(form, "vendorType") ?? "BRAND_OWNER") as VendorType,
    status: (str(form, "status") ?? "UNTOUCHED") as BrandStatus,
    clientId: str(form, "clientId"),
    mailboxId: str(form, "mailboxId"),
    contactName: str(form, "contactName"),
    email: str(form, "email")?.toLowerCase() ?? null,
    phone: str(form, "phone"),
    website: str(form, "website"),
    instagram: str(form, "instagram"),
    facebook: str(form, "facebook"),
    tiktok: str(form, "tiktok"),
    linkedin: str(form, "linkedin"),
    address: str(form, "address"),
    description: str(form, "description"),
  };
  let savedId = id;
  const returnTo = id ? `/brands/${id}` : "/brands/new";
  try {
    if (!data.name) throw new Error("Brand name is required.");
    const newCategory = str(form, "newCategory");
    if (newCategory) {
      const cat = await db.category.upsert({ where: { name: newCategory }, update: {}, create: { name: newCategory } });
      data.categoryId = cat.id;
    }
    // A worker mailbox must belong to the brand's client.
    if (data.mailboxId) {
      const mb = await db.mailbox.findUnique({ where: { id: data.mailboxId } });
      if (!mb || mb.clientId !== data.clientId) data.mailboxId = null;
    }
    const saved = id
      ? await db.brand.update({ where: { id }, data })
      : await db.brand.create({ data });
    savedId = saved.id;
  } catch (err) {
    redirect(withParam(returnTo, "error", err instanceof Error ? err.message : String(err)));
  }
  revalidatePath("/", "layout");
  redirect(withParam(`/brands/${savedId}`, "msg", "Brand saved"));
}

export async function deleteBrand(form: FormData) {
  const id = str(form, "id")!;
  await db.brand.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect(withParam("/brands", "msg", "Brand deleted"));
}

export async function setBrandStatus(form: FormData) {
  const id = str(form, "id")!;
  const status = str(form, "status") as BrandStatus;
  return run(back(form, `/brands/${id}`), async () => {
    await db.brand.update({ where: { id }, data: { status } });
  }, "Status updated");
}

// ---- drafts ----

export async function writeDraft(form: FormData) {
  const id = str(form, "brandId")!;
  return run(back(form, `/brands/${id}`), async () => {
    await wf.writeOutreachDraft(id);
  }, "Outreach draft written");
}

export async function writeFollowUp(form: FormData) {
  const id = str(form, "brandId")!;
  return run(back(form, `/brands/${id}`), async () => {
    await wf.writeFollowUpDraft(id);
  }, "Follow-up draft written");
}

export async function writeAllFollowUps(form: FormData) {
  return run(back(form, "/"), async () => {
    const due = await db.brand.findMany({ where: wf.followUpDueWhere(), select: { id: true } });
    const failures: string[] = [];
    for (const b of due) {
      await wf.writeFollowUpDraft(b.id).catch((e) => failures.push(e.message));
    }
    const done = due.length - failures.length;
    if (failures.length) throw new Error(`${done} follow-up drafts written, ${failures.length} failed: ${failures[0]}`);
    return `${done} follow-up draft${done === 1 ? "" : "s"} written`;
  });
}

export async function saveDraft(form: FormData) {
  const id = str(form, "id")!;
  return run(back(form, "/"), async () => {
    await wf.updateDraft(id, {
      toAddress: str(form, "toAddress") ?? "",
      subject: str(form, "subject") ?? "",
      body: (form.get("body") as string) ?? "",
    });
  }, "Draft saved");
}

export async function sendDraft(form: FormData) {
  const id = str(form, "id")!;
  return run(back(form, "/"), async () => {
    if (form.get("body") !== null) {
      await wf.updateDraft(id, {
        toAddress: str(form, "toAddress") ?? "",
        subject: str(form, "subject") ?? "",
        body: (form.get("body") as string) ?? "",
      });
    }
    await wf.sendDraft(id);
  }, "Email sent");
}

export async function deleteDraft(form: FormData) {
  const id = str(form, "id")!;
  return run(back(form, "/"), async () => {
    await wf.deleteDraft(id);
  }, "Draft deleted");
}

export async function simulateReply(form: FormData) {
  const id = str(form, "brandId")!;
  return run(back(form, `/brands/${id}`), async () => {
    await wf.simulateReply(id);
  }, "Simulated reply received");
}

// ---- mailboxes ----

export async function addMailbox(form: FormData) {
  const clientId = str(form, "clientId")!;
  const provider = (str(form, "provider") ?? "DEMO") as MailProvider;
  const password = str(form, "password");
  return run(back(form, `/clients/${clientId}`), async () => {
    const address = str(form, "address")?.toLowerCase();
    if (!address) throw new Error("Mailbox address is required.");
    const mailbox = await db.mailbox.create({
      data: {
        clientId,
        address,
        displayName: str(form, "displayName"),
        provider,
        imapHost: str(form, "imapHost"),
        imapPort: Number(str(form, "imapPort")) || null,
        smtpHost: str(form, "smtpHost"),
        smtpPort: Number(str(form, "smtpPort")) || null,
        username: str(form, "username"),
        passwordEnc: password ? encrypt(password) : null,
        sentFolder: str(form, "sentFolder"),
        draftsFolder: str(form, "draftsFolder"),
      },
    });
    if (provider === "IMAP") {
      try {
        await adapterFor(mailbox).test(mailbox);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.mailbox.update({ where: { id: mailbox.id }, data: { lastError: message } });
        throw new Error(`Mailbox saved, but connecting failed: ${message}`);
      }
      const { imported } = await wf.syncMailbox(mailbox.id);
      return `Mailbox connected, ${imported} messages imported`;
    }
  }, "Mailbox added");
}

export async function deleteMailbox(form: FormData) {
  const id = str(form, "id")!;
  const mb = await db.mailbox.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect(withParam(`/clients/${mb.clientId}`, "msg", "Mailbox removed"));
}

export async function syncMailbox(form: FormData) {
  const id = str(form, "id")!;
  return run(back(form, "/"), async () => {
    const { imported } = await wf.syncMailbox(id);
    return `Synced, ${imported} new message${imported === 1 ? "" : "s"}`;
  });
}
