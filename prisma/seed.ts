// Sample data so the app has something to click through. Run: npm run db:seed
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

async function main() {
  if (await db.client.count()) {
    console.log("Database already has clients, skipping seed.");
    return;
  }
  const [beauty, pets, home] = await Promise.all(
    ["Beauty & Personal Care", "Pet Supplies", "Home & Kitchen"].map((name) => db.category.create({ data: { name } })),
  );

  const abc = await db.client.create({
    data: {
      name: "ABC",
      storeName: "ABC Essentials",
      businessName: "ABC Trading LLC",
      email: "owner@abc.com",
      domains: ["abc.com"],
      website: "abc.com",
      marketplace: "WALMART",
      mailboxes: { create: { address: "worker1@abc.com", displayName: "Sarah, ABC Essentials", provider: "DEMO" } },
    },
    include: { mailboxes: true },
  });
  const xyz = await db.client.create({
    data: {
      name: "XYZ",
      storeName: "XYZ Home Store",
      businessName: "XYZ Retail Inc",
      email: "hello@xyz.com",
      domains: ["xyz.com"],
      website: "xyz.com",
      marketplace: "AMAZON",
      mailboxes: { create: { address: "worker1@xyz.com", displayName: "Ali, XYZ Home Store", provider: "DEMO" } },
    },
    include: { mailboxes: true },
  });
  const abcBox = abc.mailboxes[0];

  await db.brand.createMany({
    data: [
      { name: "GlowLab Skincare", categoryId: beauty.id, vendorType: "BRAND_OWNER", clientId: abc.id, email: "partners@glowlab.example", website: "glowlab.example", contactName: "Emma", description: "Clean skincare, strong reviews on DTC site." },
      { name: "PawPerfect", categoryId: pets.id, vendorType: "MANUFACTURER", clientId: abc.id, email: "sales@pawperfect.example", website: "pawperfect.example" },
      { name: "KitchenCraft", categoryId: home.id, vendorType: "WHOLESALER", clientId: xyz.id, email: "wholesale@kitchencraft.example", website: "kitchencraft.example" },
      { name: "Unassigned Brand Co", categoryId: home.id, vendorType: "DISTRIBUTOR", email: "info@unassigned.example" },
    ],
  });

  // A brand emailed 4 days ago with no reply, so the follow-up button is live.
  const fresh = await db.brand.create({
    data: {
      name: "HerbalRoots",
      categoryId: beauty.id,
      vendorType: "BRAND_OWNER",
      clientId: abc.id,
      email: "hello@herbalroots.example",
      website: "herbalroots.example",
      status: "EMAILED",
      firstEmailedAt: daysAgo(4),
      lastEmailedAt: daysAgo(4),
    },
  });
  await db.emailMessage.create({
    data: {
      mailboxId: abcBox.id,
      brandId: fresh.id,
      folder: "SENT",
      kind: "OUTREACH",
      messageId: "<seed-herbalroots@abc.com>",
      fromAddress: abcBox.address,
      toAddress: "hello@herbalroots.example",
      subject: "Partnership inquiry: carrying HerbalRoots on Walmart",
      body: "Hi HerbalRoots team,\n\nWe'd love to carry your products on Walmart...\n\nBest,\nSarah",
      date: daysAgo(4),
    },
  });
  console.log(`Seeded clients ${abc.name}, ${xyz.name} with sample brands.`);
}

main().finally(() => db.$disconnect());
