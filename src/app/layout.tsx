import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Brand Hunting CRM",
  description: "Track hunted brands, client outreach and worker mailboxes",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} min-h-screen bg-slate-50 font-sans text-slate-900 antialiased`}>{children}</body>
    </html>
  );
}
